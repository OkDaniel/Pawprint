import moodVeryLow from '../assets/ui/mood-very-low.png';
import moodLow from '../assets/ui/mood-low.png';
import moodOkay from '../assets/ui/mood-okay.png';
import moodGood from '../assets/ui/mood-good.png';
import moodGreat from '../assets/ui/mood-great.png';

export const moodOptions = [
  { value: 1, label: 'Very Low', sprite: moodVeryLow },
  { value: 2, label: 'Low', sprite: moodLow },
  { value: 3, label: 'Okay', sprite: moodOkay },
  { value: 4, label: 'Good', sprite: moodGood },
  { value: 5, label: 'Great', sprite: moodGreat },
] as const;
