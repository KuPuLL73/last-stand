# Lobby and battle music

The user supplied two updated tracks on 4 November 2026 and explicitly mapped GAME to the lobby and MINE to gameplay. Final verification: 5 November 2026.

| Runtime asset | User source | Duration | Source SHA-256 |
|---|---|---:|---|
| `menu-theme.mp3` | Project audio source | 158.17 s | `87dda78e8eab86c020d576fda679b9058a7282829be2fb88f12950b0e46b5519` |
| `battle-theme.mp3` | Project audio source | 282.98 s | `e93d9df99eb3bc788886a98a8d69d0c4acd7b7eb6bc5226cdbdb0e694df8848a` |

The source files remain unchanged. Runtime copies were encoded with FFmpeg/libmp3lame at 160 kb/s stereo, without trimming, mixing or loudness changes. This halves their combined size from 17,646,352 to 8,825,295 bytes.

- Menu asset: 3,164,517 bytes; SHA-256 `8aa79e4b9006f4902fae7066680aaf99b370f0ab8574cb064dbf529ac3a14bfc`.
- Battle asset: 5,660,778 bytes; SHA-256 `1e7173456f66f52b607831d5f7b711608fa8ea687b9bf670f8d6ff18202fa543`.

`game/music-director.js` owns exclusive scene transitions. The first gesture unlocks both players; only the active channel plays. The lobby track plays in the ready scene and its dialogs. The battle track plays during combat and upgrade selection. Manual game pause, result screens, platform interruption, page hide and mute stop playback. Both tracks follow the single saved music slider independently of SFX, loop, fade in and preserve their positions when paused. `game/menu-music.js` guards late play promises separately for each channel.

This note records asset provenance and requested use; no third-party authorship or license attribution has been invented.
