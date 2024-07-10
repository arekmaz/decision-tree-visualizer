import { Schema as S } from '@effect/schema';
import { Option, Equal, Data } from 'effect';
import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from '@remix-run/react';

function objectFromEntries(input: string[][]): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  input.forEach(([key, value]) => {
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(value);
  });

  return result;
}

export function entriesFromObject(obj: {
  [x: string]: readonly string[] | undefined;
}): string[][] {
  const result: string[][] = [];

  for (const key in obj) {
    const val = obj[key];
    if (Object.prototype.hasOwnProperty.call(obj, key) && val) {
      val.forEach((value) => {
        result.push([key, value]);
      });
    }
  }

  return result;
}

const searchParamsFromObject = (input: {
  [x: string]: readonly string[] | undefined;
}) => new URLSearchParams(entriesFromObject(input));

const SearchParams = S.instanceOf(URLSearchParams);

const RecordFromSearchParams = SearchParams.pipe(
  S.transform(S.Record(S.String, S.UndefinedOr(S.Array(S.String))), {
    decode: (s) => objectFromEntries(Array.from(s.entries())),
    encode: (a) => new URLSearchParams(entriesFromObject(a)),
    strict: true,
  }),
);

export const makeSearchParamsSchema = <
  A,
  I extends { [x: string]: undefined | readonly string[] },
  R,
>(
  s: S.Schema<A, I, R>,
) => S.compose(RecordFromSearchParams, s);

export const RequiredHead = <A, B, R>(s: S.Schema<A, B, R>) =>
  S.NonEmptyArray(S.Any).pipe(
    S.transform(s, {
      decode: (a) => a[0],
      encode: (s) => [s] as const,
      strict: true,
    }),
  );

export const BooleanFromString = S.String.pipe(
  S.transform(S.Boolean, {
    decode: (s) => s === 'true',
    encode: (b) => String(b),
    strict: true,
  }),
);

export const makeSearchParamsHook = <
  A extends Record<string, unknown>,
  I extends Record<string, undefined | readonly string[]>,
>(
  schema: S.Schema<A, I, never>,
  defaultValue: NoInfer<A>,
) => {
  const searchParamsSchema = schema;

  const encodeSync = S.encodeSync(searchParamsSchema);

  // validate default value can be encoded
  const encodedDefaultValue = encodeSync(defaultValue);

  return () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const lastValueRef = useRef<A>();

    const value = useMemo(() => {
      const object = objectFromEntries(Array.from(searchParams.entries()));
      const decoded = S.decodeUnknownOption(searchParamsSchema)(object);

      if (Option.isNone(decoded)) {
        lastValueRef.current = defaultValue;
        return defaultValue;
      }

      if (
        lastValueRef.current !== undefined &&
        Equal.equals(
          Data.struct(lastValueRef.current),
          Data.struct(decoded.value),
        )
      ) {
        return lastValueRef.current as A;
      }

      lastValueRef.current = decoded.value;

      return lastValueRef.current;
    }, [searchParams]);

    const set = useCallback(
      (fn: Partial<A> | ((a: A) => A)) => {
        if (typeof fn === 'function') {
          setSearchParams((prev) => {
            const object = objectFromEntries(Array.from(prev.entries()));
            const decoded = S.decodeUnknownOption(searchParamsSchema)(object);

            if (Option.isNone(decoded)) {
              const encodeResult = S.encodeOption(searchParamsSchema)(
                fn(defaultValue),
              );

              return searchParamsFromObject(
                Option.isNone(encodeResult)
                  ? encodedDefaultValue
                  : encodeResult.value,
              );
            }

            const transformed = fn(decoded.value);

            if (!S.is(searchParamsSchema)(transformed)) {
              return searchParamsFromObject(encodedDefaultValue);
            }

            if (
              Equal.equals(Data.struct(transformed), Data.struct(decoded.value))
            ) {
              return prev;
            }

            return searchParamsFromObject(encodeSync(transformed));
          });
          return;
        }

        setSearchParams((prev) => {
          const object = objectFromEntries(Array.from(prev.entries()));
          const decoded = S.decodeUnknownOption(searchParamsSchema)(object);

          if (Option.isNone(decoded)) {
            const transformed = { ...defaultValue, ...fn };
            const encodeResult =
              S.encodeOption(searchParamsSchema)(transformed);

            return searchParamsFromObject(
              Option.isNone(encodeResult)
                ? encodedDefaultValue
                : encodeResult.value,
            );
          }

          const transformed = { ...decoded.value, ...fn };

          if (!S.is(searchParamsSchema)(transformed)) {
            return searchParamsFromObject(encodedDefaultValue);
          }

          if (
            Equal.equals(Data.struct(transformed), Data.struct(decoded.value))
          ) {
            return prev;
          }

          return searchParamsFromObject(encodeSync(transformed));
        });
      },
      [setSearchParams],
    );

    return [value, set] as const;
  };
};

