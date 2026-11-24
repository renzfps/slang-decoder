# Slang Decoder (Chrome extension)

![Uploading {E2A51AAF-E605-4DBC-BC17-D2DAA0039E78}.png…]()



Underlines internet slang like "lol", "lmfao", "idk" and "ngl" on any web page.
Hover over an underlined word to see what it means.

## Install (takes about a minute)

1. Unzip `slang-decoder.zip` somewhere you'll keep it (e.g. your Documents folder).
2. In Chrome, go to `chrome://extensions`.
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the unzipped `slang-decoder` folder.
5. Pin the extension (puzzle-piece icon → pin) so you can toggle it on/off.

Open `test.html` from the folder in Chrome to try it out. (To use it on local
files, open the extension's **Details** and enable "Allow access to file URLs".)

## Features

- Works on every site, including chat apps where new messages keep appearing.
- Leaves text boxes, code blocks and anything you're typing untouched.
- Doesn't match slang hidden inside other words ("lollipop" stays plain).
- Words that are also normal English ("goat", "rip") only count in ALL CAPS.
- On/off switch in the toolbar popup.

## Adding your own slang

Open `dictionary.js` and add a line inside `SLANG_DICTIONARY`, e.g.

    "wfh": "Working from home",

Keys must be lowercase. Then click the reload icon on the extension's card in
`chrome://extensions` and refresh the page.
