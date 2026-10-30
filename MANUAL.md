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
| Any other system | Name, bar 1 (everyone, described for neutral and hostile tokens), bar 2 (GM, owners and observers), effects and conditions (everyone). The bars show the attributes the token shows as its bars. |

Some values are often needed in play but not at every table. They are part of the preset and start switched off, so a tick in *Show* is all it takes:

| System | Switched off until you tick them |
| --- | --- |
| D&D 5e | Passive Insight, passive Investigation, spell save DC (only actors that cast spells), inspiration (characters, shows *Yes*) and senses (darkvision, blindsight, tremorsense, truesight with their range). Inspiration is for everyone with the party and friendly tokens, the others for the GM, owners and observers |
| Pathfinder 2e | Hero Points (characters), Focus Points (only with a maximum above zero), class DC |
| Savage Worlds | Running die, Power Points (only with a maximum above zero), rank |
| Crucible | Action points, focus, heroism |

Values that a token does not have stay out of its tooltip, for example the CR of a player character or temp HP of zero. Effects and conditions are the ones Foundry draws on the token.

Things get no tooltip: heaps, chests and vaults of the Item Piles module (merchants keep theirs) and loot actors of Pathfinder 2e. A token outside the window gets none either, also when it is hovered through the combat tracker or while Alt is held.

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

## Keys

| Key | Does |
| --- | --- |
| Alt (hold) | Shows the tooltips of all visible tokens, a little smaller, until the key is released |

The key can be changed in Foundry's key settings (*Show all tooltips*).

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
| Follow the name display of each token | Names only when the token shows its name to everyone (default on) |
| Configure fields | Opens the field window (GM) |
| Self test | Checks the module and reads every field from a token of the viewed scene (GM) |
| Save debug file | One file about all of Sephral’s modules for bug reports (GM), see [Debug file](#debug-file) |

## Usage statistics

The module can take part in a small usage report shared by all of Sephral’s modules. Nothing is counted or sent until the GM agrees: shortly after the world starts, the active GM is asked, and the question comes back at every start until there is an answer. The answer counts for all of Sephral’s modules in the world. *Share usage statistics* in the module settings turns the report on or off at any time, and *Manage statistics* below it shows what the report contains right now.

With the GM’s consent only the active GM’s browser counts, and it sends at most one report a day. The counts are kept in a hidden world setting, so all browsers and computers of the GM count together, and turning the statistics off deletes them. A copy of a world gets its own world ID. The question lists everything the report contains, from the Foundry version to a random world ID. For Token Tooltips it holds:

* on how many of the last 30 days the module was used
* whether the GM saw a tooltip and held the key for all tooltips (once per session each), how often the GM saved the fields and added an own field
* the settings *Look*, *Show tooltips*, *Position*, *Size* and *Follow the name display of each token* (only the chosen option)
* where errors occur in the module code: file, line and error type, never the error message

No names, values, data paths or other content of the world are sent, and nothing the players do is counted.

## Debug file

For bug reports, the GM saves one file about all of Sephral’s modules in this world: `Save debug file` in the module settings, or `Save Debug File (Sephral’s Modules)` in the context menu of a chat message. It holds the versions of Foundry, the system and the active modules, the settings of the modules and what they recorded, for Token Tooltips the preset of the system, every field with its audience and forms, the paths of own fields, the fields other modules added and whether a tooltip is on the screen. No values of tokens are copied. Macros call `game.modules.get("sephrals-token-tooltips").api.saveDebugFile()`.

The file contains chat text and whispers. Check it before you share it.

## Storage

* The field configuration is kept in the world settings, one entry per game system. Back up the world to keep it.
* Look, delay, position, size and *Show tooltips* stay in each browser.

## Compatibility

* Foundry VTT 13 and 14, any game system. Presets for D&D 5e (5 and 6), Pathfinder 2e, Savage Worlds (5 and 6) and Crucible.
* The tooltips sit above the map and below windows, the sidebar and the floating bars of other modules such as Token Action HUD.
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
