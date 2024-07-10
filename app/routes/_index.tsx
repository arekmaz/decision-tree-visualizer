import { Schema } from '@effect/schema';
import type { MetaFunction } from '@remix-run/node';
import { useSearchParams } from '@remix-run/react';
import { makeSearchParamsHook, RequiredHead } from '~/searchParamHelpers';

export const meta: MetaFunction = () => {
  return [
    { title: 'Decision Tree Visualizer' },
    { name: 'description', content: 'Visualize a Tree of Decisions' },
  ];
};

function combineArrays(arrays: string[][]): string[][] {
  if (arrays.length === 0) {
    return [];
  }

  // Base case: if there's only one array, return it as the first level
  if (arrays.length === 1) {
    return [arrays[0]];
  }

  // Combine elements of the first array with the combinations of the rest
  function combineTwoArrays(arr1: string[], arr2: string[]): string[] {
    const result: string[] = [];
    for (const item1 of arr1) {
      for (const item2 of arr2) {
        result.push(`${item1}-${item2}`);
      }
    }
    return result;
  }

  // Start with the first array
  const result: string[][] = [arrays[0]];

  // Iteratively combine arrays
  for (let i = 1; i < arrays.length; i++) {
    const combined = combineTwoArrays(result[result.length - 1], arrays[i]);
    result.push(combined);
  }

  return result;
}

const StepEntry = Schema.NonEmpty.pipe(
  Schema.maxLength(1000),
  Schema.compose(Schema.split('_')),
  Schema.compose(Schema.Array(Schema.split(',')))
);

const SearchParamsSchema = Schema.Struct({
  steps: Schema.optional(RequiredHead(StepEntry)),
});

const useStepsParams = makeSearchParamsHook(SearchParamsSchema, {});

export default function Index() {
  const [{ steps }] = useStepsParams();
  const [, setSearchParams] = useSearchParams();

  if (!steps) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();

          const newSteps = new FormData(e.currentTarget).get('steps') as string;

          setSearchParams({ steps: newSteps });
        }}
        className="h-screen w-screen flex items-center justify-center "
      >
        <label className="flex flex-col">
          Enter steps formula in the format s1,s2_r1,r2,r2, where s,r are the
          possible choice steps
          <input
            name="steps"
            placeholder="s1,s2_r1,r2,r3"
            className="text-xl border-2 rounded-lg border-blue-500 px-2 py-5 text-center"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </label>
      </form>
    );
  }

  const choiceLists = combineArrays(steps);

  return (
    <div className="h-screen w-screen flex flex-col items-stretch">
      {choiceLists.map((choiceList, choiceListIndex) => {
        return (
          <div key={choiceListIndex} className="flex-1 flex">
            <div className="px-2 flex items-center">{choiceList.length}</div>
            <div className="flex-1 overflow-x-auto overflow-y-visible flex py-2 relative">
              {choiceList.map((choice, choiceIndex) => (
                <div
                  key={choiceIndex}
                  className="flex-1 shrink-0 flex items-center justify-center hover:scale-105 z-20 hover:relative bg-white rounded-md cursor-pointer"
                  title="click to copy to clipboard"
                  style={{
                    fontSize:
                      10 + choiceLists.length / choiceListIndex ** 1.6 + 'px',
                  }}
                  onClick={() =>
                    globalThis.navigator.clipboard.writeText(choice)
                  }
                >
                  {choice}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
