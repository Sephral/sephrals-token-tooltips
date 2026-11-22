# Sephral’s Token Tooltips: Manual

Rest the pointer on a token and a tooltip appears next to it after a short pause. It shows the token's name and the values the GM chose, each one only to the people allowed to see it. The tooltip follows the token when the view moves, hides while a mouse button is held on the map (moving tokens, measuring, selecting) and when the token's HUD opens.

## What the tooltip shows

Each game system has a preset of fields. The GM switches fields on and off, changes their order and decides who sees them (see [Who sees what](#who-sees-what)).

| System | Fields (default audience) |
| --- | --- |
| D&D 5e | Name (everyone), HP (everyone, described for neutral and hostile tokens), temp HP, AC, passive Perception, level of characters (GM, owners and observers), speed with every movement type (everyone), CR of NPCs (GM only), effects and conditions (everyone) |
| Pathfinder 2e | Name, HP, speed, effects and conditions (everyone, HP described for neutral and hostile tokens), temp HP, AC, Perception (GM, owners and observers), level (GM only), Fortitude, Reflex and Will (off) |
| Savage Worlds | Name, wounds (described for neutral and hostile tokens), pace, effects (everyone), fatigue, Parry, Toughness with armor, bennies (GM, owners and observers) |
| Crucible | Name, health, morale, stride, effects (everyone, health and morale described for neutral and hostile tokens), wounds, madness, physical defense (GM, owners and observers), level (GM only), Fortitude, Reflex and Willpower (off) |
| Daggerheart | Name, hit points marked (described for neutral and hostile tokens), effects (everyone), stress, hope, armor, evasion, level of characters, difficulty and tier of adversaries (GM only) |
| Call of Cthulhu 7th Edition | Name, HP (described for neutral and hostile tokens), movement rate, effects (everyone), magic points, sanity, luck of characters, armor (GM, owners, observers) |
| Shadowdark RPG | Name, HP (described for neutral and hostile tokens), movement band of monsters, effects (everyone), AC, level, luck token of players (GM, owners, observers) |
| Project FU | Name, HP (described for neutral and hostile tokens), effects (everyone), mind points, defense, magic defense, fabula points of characters, level (GM, owners, observers) |
| Shadowrun 6th Edition | Name, physical monitor (described for neutral and hostile tokens), effects (everyone), stun monitor, edge, defense rating (GM, owners, observers) |
| Dolmenwood | Name, HP (described for neutral and hostile tokens), speed, effects (everyone), AC, level (GM, owners, observers) |
| RuneQuest: Roleplaying in Glorantha | Name, HP (described for neutral and hostile tokens), movement rate, effects (everyone), magic points, hero points (GM, owners, observers) |
| Any other system | Name, bar 1 (everyone, described for neutral and hostile tokens), bar 2 (GM, owners and observers), effects and conditions (everyone). The bars show the attributes the token shows as its bars. |

Some values are often needed in play but not at every table. They are part of the preset and start switched off, so a tick in *Show* is all it takes:

| System | Switched off until you tick them |
| --- | --- |
| D&D 5e | Passive Insight, passive Investigation, spell save DC (only actors that cast spells), inspiration (characters, shows *Yes*) and senses (darkvision, blindsight, tremorsense, truesight with their range). Inspiration is for everyone with the party and friendly tokens, the others for the GM, owners and observers |
| Pathfinder 2e | Hero Points (characters), Focus Points (only with a maximum above zero), class DC |
| Savage Worlds | Running die, Power Points (only with a maximum above zero), rank |
| Crucible | Action points, focus, heroism |
| Daggerheart | Damage thresholds (major and severe) |
| Call of Cthulhu 7th Edition | Build, damage bonus |
| Project FU | Inventory points, zenit, initiative, in crisis (shows *Yes*, for everyone) |
| Shadowrun 6th Edition | Initiative |

The presets of Daggerheart, Call of Cthulhu 7th Edition, Shadowdark, Project FU, Shadowrun 6th Edition, Dolmenwood and RuneQuest were written from the data models of the system releases listed under [Compatibility](#compatibility). Daggerheart counts hit points and stress as marked boxes, so a higher value is worse, and the health word follows the unmarked share.

### Distance, elevation and cover

Three fields exist for every system and start switched off, so existing worlds do not change. Tick *Show* in the field window to use them. They follow the audience and forms of the field like every other value.

| Field | Shows |
| --- | --- |
| Distance | The distance from your token to the hovered one in the units of the scene, for example *35 ft*. It counts from your selected token (the first one other than the hovered token), else from the token of your character. Without either, the field stays out |
| Elevation | The elevation of the token and, in brackets, the difference to your token, for example *10 ft (+5)*. Tokens on the ground with a viewer on the ground show nothing |
| Cover | The cover the token has, where the system knows it: the cover status of D&D 5e (half, three quarters, total) and the cover effect of Pathfinder 2e (shows *Yes*). Other systems have no cover field |

The distance is measured with the grid of the scene from the nearest space of one token to the nearest space of the other, so tokens next to each other are one step apart whatever their size, and diagonals follow the rule of the scene. Hex grids work the same way. Without a grid the gap between the two token frames counts. The measurement is horizontal, the elevation is its own field. The tooltips follow the selection and the moves of the token they count from. The preview in the field window measures from the nearest other token when nothing else is selected.
Values that a token does not have stay out of its tooltip, for example the CR of a player character or temp HP of zero. Effects and conditions are the ones Foundry draws on the token.

Things get no tooltip: heaps, chests and vaults of loot pile modules (merchants keep theirs) and loot actors of Pathfinder 2e. A token outside the window gets none either, also while Alt is held. In the combat tracker the tooltip belongs to the entry instead, see [Combat tracker](#combat-tracker).

### Health words

Fields with a current and a maximum value (HP, health, morale, token bars) and counts that grow worse (wounds, madness) can be shown as a word instead of numbers:

| Word | Health left |
| --- | --- |
| Unhurt | all |
| Wounded | more than half |
| Bloodied | half or less |
| Near death | a quarter or less |
| Down | none (not used for counts like wounds) |

Fatigue, armor, speed and other numbers have no word form. If they are set to *Described*, they stay hidden.

## Who sees what

Open *Configure fields* in the module settings (GM). Each field has:

* **Show:** the field is part of the tooltip at all.
* **Who sees it:** *GM only*, *GM, owners, observers* or *Everyone*. The GM, the owners and the observers of a token always see the exact value when the field is meant for them. Observers are players with the permission *Observer* for the token's actor: they can open its whole sheet anyway. *Limited* permission counts as everyone else.
* **Everyone else sees it:** only for *Everyone*. One choice for party members and one per token disposition (friendly, neutral, hostile, secret): *Exact*, *Described* (the health word) or *Hidden*.
* **Party members** are the tokens of player characters: an actor that a player owns. The other players see them in the form of the *Party member* column, whatever the token's disposition. Set it to *Described* in the HP row and the players only see how their companions are doing, not their numbers. Friendly NPCs keep the *Friendly* column. By default party members show like friendly tokens.
* **Look:** for fields with a maximum, *Bar and numbers*, *Bar* or *Numbers*.

The arrows change the order. *Reset to defaults* brings the preset back and removes your own fields, nothing changes before *Save*.

Rules that always apply:

* Players never get a tooltip for a hidden token or a token they cannot see (fog, vision, another level in Foundry 14).
* With *Follow the name display of each token* (on by default) players only see a name when the token shows its name to everyone on hover or always, as set in the token's configuration. Owners and observers always see it.
* Secret tokens show nothing to players by default. Foundry 14 shows no hover for them at all.

The preview on the right shows the selected token (or the first token of the scene) as the GM, as its owner or an observer and as another player. The last one can be switched to a party member or another disposition to check every column.

### Your own fields

Below the list, *Add your own field* takes a label, a data path and a format. You rarely need to type the path:

* **Pick…** opens a list with two tabs above the row. *Common values* holds many values of the system that no preset field shows yet, in groups. The first group is *Often needed in play*, for example exhaustion, initiative, spell attack and the senses in D&D 5e, Perception DC, Stealth DC and the shield in Pathfinder 2e, conviction and size in Savage Worlds or passive Awareness, armor and dodge in Crucible. Further groups follow: resources, spellcasting, defenses, abilities and skills, currency, progression and traits. Values that already are a field stay out of it. *All values* lists every value of the selected token (or the first token of the scene) with its current value, grouped by the first part of the path. Values with a current value and a maximum appear once, as a resource.
* The search above the list finds values by their name, their path or their value. Enter takes the first value, Escape closes the list.
* A click on a value fills in the path, a label you can change and the fitting format.
* While you type, the browser suggests paths from both lists.
* The line below the row shows the value of the selected token at the path as the tooltip would show it, or says that the token has no value there.

The path points into the actor's data, for example `system.attributes.hp` or `system.currency.gp`. A path starting with `token.` reads the token instead, for example `token.elevation`. Systems without a preset have no common values, *All values* works for every system.

The formats:

* *Number*, *Text*: the value as it is. A yes or no value shows *Yes*, and nothing when it is no.
* *Modifier*: a number with its sign, such as +3.
* *List*: a list of words. Damage types, conditions, sizes, creature types and languages of the common values show their names, not the keys the system stores.
* *Resource*: an object with `value` and `max`, shown as bar or numbers and with health words. *Count*: like a resource, but a higher value is worse.
* *Die*: a die size such as d8, or d8+1 for a Savage Worlds trait.

Own fields start for the GM, owners and observers. The trash can removes them.

### Export and import

*Export* at the bottom of the field window saves the fields of this system as a JSON file: which fields show, their order, audience, forms and look, and your own fields with their data paths. No token values are in it. *Import* reads such a file and shows first what would change: new own fields, fields that are removed, changed settings per field (show, who sees it, forms, look) and a changed order. Then you choose:

* **Merge:** fields the file does not mention stay as they are. Own fields of the file are added, and one whose id is already in use for another own field gets a new id.
* **Replace:** the file decides everything. Fields it does not mention return to their defaults and own fields that are not in the file are removed.

*Take over* changes the list in the window only, nothing is stored before *Save*, so the preview shows the result and a click on *Reset to defaults* or closing the window undoes it. A file from another system is read as far as its fields exist here, the others are skipped and counted. Files from a newer version of the module and files of other modules are refused.

## Combat tracker

With the setting *Tooltips in the combat tracker* (on by default, this device only) the tooltip of a combatant appears next to its entry in the combat tracker after the usual delay, built exactly like the tooltip of the token: same fields, audiences and forms for you, and the same rules for tokens a player cannot see. Combatants that are hidden from players are not listed for them, so they get nothing either. The token does not need to be on the screen, but it has to be on the viewed scene. While the pointer is on an entry, the tooltip of the token on the map does not also appear. The core tracker and its pop out window are supported on Foundry 13 and 14, a tracker that replaces the core one simply gets no tooltips.

## Floating numbers

When the hit points of a token change, a number floats up from it. Every client decides for itself what its user sees, by the rules of the health field in the field window (audience, form per token disposition, party form). Nothing travels over the network.

| Who | What floats |
| --- | --- |
| GM, owners and observers | The exact number, red for damage and green for healing |
| Others, form *Exact* | The exact number |
| Others, form *Described* | A description by the size of the blow: *A scratch* (up to a tenth of the maximum), *Hurt* (a quarter), *Badly hurt* (half), *A brutal blow*, *Down* when it ends at zero. Healing: *A little better*, *Better*, *Much better*, *Fully healed* |
| Others, form *Hidden*, or a health field the GM switched off | Nothing |

Temporary hit points count with the rest. The health field of each preset: *HP* (D&D 5e, Pathfinder 2e), *Health* (Crucible), *Wounds* (Savage Worlds, shown as "+1 Wounds" when one is gained, descriptions without a share) *Marked hit points* (Daggerheart), the physical monitor (Shadowrun 6th Edition) and *Bar 1* (every other system). A heap, a chest and tokens the viewer cannot see float nothing.

### Numbers the system floats itself

D&D 5e, Pathfinder 2e and Crucible float their own exact numbers on every screen, so players would see the hit points of every monster. The setting *Floating numbers* chooses:

* **Replace the system's numbers:** the module changes the system's text on its way to the screen. Exact stays as it is, described becomes the description, hidden drops it. No second number appears. In Crucible only the health number is changed, morale and other texts stay. Shadowdark floats the signed change of its hit points like D&D 5e and is treated the same way. Savage Worlds and systems without numbers of their own (Call of Cthulhu 7th Edition, Shadowrun 6th Edition, Dolmenwood, RuneQuest, token bars) get a number from the module. Daggerheart and Project FU float texts of their own that cannot be read as an amount: the module leaves their numbers alone and floats none.
* **Only where the system shows none** (default, so an update changes nothing in a running world): the systems above keep their numbers untouched. Savage Worlds and the systems without numbers of their own get the module's numbers.
* **Off:** the module floats nothing and changes nothing.

Foundry's own client setting *Scrolling Status Text* (core settings) turns every floating number off on a device, also these. Numbers from other modules that are not hit point changes of a token pass unchanged. A module that floats its own hit point numbers in addition cannot be recognized, choose *Off* or *Only where the system shows none* if two numbers appear.

## Keys

| Key | Does |
| --- | --- |
| Alt (hold) | Shows the tooltips of all visible tokens, a little smaller, until the key is released. With the setting *Show all tooltips* on *Press once* the first press switches them on and the next press off, and a small note at the top of the screen says so. |

The key can be changed in Foundry's key settings (*Show all tooltips*). Switching the scene, opening the token HUD or changing a tooltip setting switches a toggled key off again.

**Tooltips at the start of a turn (GM):** with the setting *Tooltips at the start of a turn* on (default off, this device only), the GM sees the tooltips of all visible tokens for 4 seconds (setting *Seconds for the turn tooltips*, 1 to 15) whenever the turn or round of the active combat of the viewed scene changes, also when combat starts. A held or toggled key keeps them on after that. The field audiences and forms apply exactly as for hovering, so what a player sees never changes, and players never get these tooltips.

## Settings

All options are in *Game Settings → Configure Settings → Sephral’s Token Tooltips*. The gear in the title bar of the field window opens them directly.

| Setting | What it does |
| --- | --- |
| Module language | Follow Foundry, German or English, for you |
| Look | Warm paper colors (Signature) or the dark colors of Foundry, for you |
| Show tooltips | Switch the tooltips off on this device, for you |
| Delay | How long the pointer rests before the tooltip appears, 0 to 1500 milliseconds (default 350), for you |
| Position | Right of, above or below the token. The tooltip moves to the other side when there is no room, for you |
| Size | Small, normal or large text, for you |
| Show all tooltips | The key for all tooltips: hold (default) or press once to switch on and again to switch off, for you |
| Tooltips at the start of a turn (GM) | All tooltips for a few seconds at each combat turn, off by default, for you |
| Seconds for the turn tooltips | 1 to 15, default 4, for you |
| Tooltips in the combat tracker | The tooltip of a combatant next to its entry in the tracker, default on, for you |
| Follow the name display of each token | Names only when the token shows its name to everyone (default on) |
| Floating numbers | Replace the system's numbers, only where the system shows none (default), or off, for the world (GM) |
| Configure fields | Opens the field window (GM) |
| Self test | Checks the module and reads every field from a token of the viewed scene (GM) |
| Save debug file | One file about all of Sephral’s modules for bug reports (GM), see [Debug file](#debug-file) |

## Usage statistics

The module can take part in a small usage report shared by all of Sephral’s modules. Nothing is counted or sent until the GM agrees: shortly after the world starts, the active GM is asked, and the question comes back at every start until there is an answer. The answer counts for all of Sephral’s modules in the world. *Share usage statistics* in the module settings turns the report on or off at any time, and *Manage statistics* below it shows what the report contains right now.

With the GM’s consent only the active GM’s browser counts, and it sends at most one report a day. The counts are kept in a hidden world setting, so all browsers and computers of the GM count together, and turning the statistics off deletes them. A copy of a world gets its own world ID. The question lists everything the report contains, from the Foundry version to a random world ID. For Token Tooltips it holds:

* on how many of the last 30 days the module was used
* whether the GM saw a tooltip, held or toggled the key for all tooltips and saw the tooltips at a turn start (once per session each), how often the GM saved, exported and imported the fields and added an own field, whether the GM saw distance, elevation or cover and a tooltip in the combat tracker (once per session each), how many floating numbers the GM's screen showed or ruled on
* the settings *Look*, *Show tooltips*, *Position*, *Size*, *Show all tooltips*, *Tooltips at the start of a turn*, *Follow the name display of each token* and *Floating numbers* (only the chosen option)
* where errors occur in the module code: file, line, error type and whether the error arose in the module itself, in Foundry, in the game system or in another module, never the error message or the name of another module

No names, values, data paths or other content of the world are sent, and nothing the players do is counted.

## Debug file

For bug reports, the GM saves one file about all of Sephral’s modules in this world: `Save debug file` in the module settings, or `Save Debug File (Sephral’s Modules)` in the context menu of a chat message. It holds the versions of Foundry, the system and the active modules, the settings of the modules and what they recorded, for Token Tooltips the preset of the system, every field with its audience and forms, the paths of own fields, the fields other modules added and whether a tooltip is on the screen. No values of tokens are copied. Macros call `game.modules.get("sephrals-token-tooltips").api.saveDebugFile()`.

The file contains chat text and whispers. Check it before you share it.

## Sephral’s Modules

The first button in the module settings, *Sephral’s Modules* (GMs only), opens one window for all of Sephral's modules in the world: the version, self test, settings, manual and demo video of each, a button that switches on an installed module that is off (Foundry then reloads the world for everyone), and the debug file. Below, *More from Sephral* lists other modules that fit the game system of the world, shown only after a click, each with its demo video and an *Install* button. Foundry installs modules only on its setup screen, so the button copies the module's link (manifest URL) and shows the steps with a short clip. When the GM launches the world again, the window opens once with the new module and its *Enable* button. The list is part of the module. Only a video you start is loaded, from the module page on GitHub. If the GM agreed to the usage statistics, the window also counts how it is used: opened, the other modules shown, a video or install link of one of them, a module installed or switched on from it. It never records which module.

## Storage

* The field configuration is kept in the world settings, one entry per game system. Back up the world to keep it.
* Look, delay, position, size and *Show tooltips* stay in each browser.

## Compatibility

* Foundry VTT 13 and 14, any game system. Presets for D&D 5e (5 and 6), Pathfinder 2e, Savage Worlds (5 and 6), Crucible, Daggerheart, Call of Cthulhu 7th Edition, Shadowdark, Project FU, Shadowrun 6th Edition, Dolmenwood and RuneQuest.
* The data paths of the newer presets were read from the released systems: Daggerheart 2.12.9, Call of Cthulhu 7th Edition 9.2, Shadowdark 4.1.1, Project FU 4.16.3 and 5.0.0 rc 3, Shadowrun 6th Edition (Eden) 4.0.11, Dolmenwood 2.3.0 and RuneQuest 6.1.1. These systems decide which Foundry versions they run on. The module tells the GM once when a newer version of the system is installed.
* The tooltips sit above the map and below windows, the sidebar and the floating bars of other modules.
* Like every value that reaches a player's browser, the data behind a tooltip could be read by a player who opens the browser tools. Token Tooltips decides what is shown, not what Foundry sends.

## API

`game.modules.get("sephrals-token-tooltips").api`:

| Function | Does |
| --- | --- |
| `registerField(data)` | Adds a field from another module, see below |
| `fields()` | The configured fields of this world, in order |
| `registeredFields()` | The fields other modules added |
| `openConfig()` | Opens the field window (GM) |
| `refresh()` | Redraws the tooltips on the screen |
| `runSelfTest()` | The self test (GM) |
| `saveDebugFile()` | Saves the debug file of Sephral’s modules (GM) |
| `samples()` | Lists sample windows with made-up tokens: tooltips as GM and as a player, all tooltips at once, floating numbers, the field window and its import question |

The sample windows show the tooltip elements of a made-up party and its foes, rendered by the module's own code from actors that exist only in memory. They create no token, change no scene and save nothing, buttons that would save, export or import only say that they do nothing.

`registerField` takes:

| Key | Meaning |
| --- | --- |
| `id` | Unique id of letters, digits, `-` and `_` |
| `label` | Text or translation key |
| `type` | `number`, `text`, `list`, `resource`, `count`, `movement` (a list of `{type, value, units}`) or `effects` (a list of `{name, img}`), default `text` |
| `read(actor, token)` | Returns the value, or `null` to leave the field out. Instead of `read`, `path` reads a data path of the actor |
| `systems` | Game system ids the field is for, all systems when left out |
| `icon` | Font Awesome classes, for example `fa-solid fa-star` |
| `defaults` | `{enabled, audience, forms, display}`: audience `gm`, `owner` (GM, owners and observers) or `everyone`, forms per `party`, `friendly`, `neutral`, `hostile`, `secret` with `exact`, `descriptive` or `hidden` (without `party` the party uses the `friendly` form). Without defaults the field is on for the GM, owners and observers |

Register fields in the `init` or `ready` hook on every client. The GM configures them like the preset's fields, and their choice wins over the defaults.

```js
Hooks.once("ready", () => {
  game.modules.get("sephrals-token-tooltips")?.api.registerField({
    id: "inspiration", label: "Inspiration", type: "text", systems: ["dnd5e"], icon: "fa-solid fa-sun",
    read: actor => (actor?.system.attributes?.inspiration ? "✓" : null)
  });
});
```
