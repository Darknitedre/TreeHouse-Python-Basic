import { Story, Testament } from '../../types/content';

// ┌──────────────────────────────────────────────────────────────┐
// │ TO ADD A STORY: copy one of the .json files in this folder,  │
// │ give it a new "id", edit the text, then add one line below.  │
// └──────────────────────────────────────────────────────────────┘
const ALL: Story[] = [
  require('./creation.json'),
  require('./noah.json'),
  require('./abraham.json'),
  require('./joseph.json'),
  require('./moses-exodus.json'),
  require('./david-goliath.json'),
  require('./jonah.json'),
  require('./daniel.json'),
  require('./esther.json'),
  require('./birth-of-jesus.json'),
  require('./parables.json'),
  require('./crucifixion-resurrection.json'),
  require('./pauls-journeys.json'),
];

export const stories: Story[] = [...ALL].sort((a, b) =>
  a.testament === b.testament ? a.order - b.order : a.testament === 'OT' ? -1 : 1,
);

export function getStory(id: string): Story | undefined {
  return stories.find((s) => s.id === id);
}

export function storiesByTestament(testament: Testament): Story[] {
  return stories.filter((s) => s.testament === testament);
}
