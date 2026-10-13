import { Lecture } from '../../types/content';

// ┌──────────────────────────────────────────────────────────────────┐
// │ TO ADD A LECTURE: copy one of the .json files in this folder,    │
// │ set "storyId" to the id of a story, edit the sections, then add  │
// │ one line below. It will appear in the Listen tab automatically.  │
// └──────────────────────────────────────────────────────────────────┘
const ALL: Lecture[] = [
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

export function getLecture(storyId: string): Lecture | undefined {
  return ALL.find((l) => l.storyId === storyId);
}
