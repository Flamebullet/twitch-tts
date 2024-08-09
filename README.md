# Quick Start

1. Launch the exe follow the steps to setup and enjoy :3

Config files are stored under `%USERPROFILE%/twitch-tts`

# Change voices

To change voice download and launch the checkvoices.exe file to see what voices you have downloaded, then replace the "Microsoft David Desktop" under the voice in your .env file

To download more voices head over to the following link for more instructions https://support.microsoft.com/en-gb/topic/download-languages-and-voices-for-immersive-reader-read-mode-and-read-aloud-4c83a8d8-7486-42f7-8e46-2b0fdf753130

# Shortcuts

-   <kbd>Alt</kbd> + <kbd>S</kbd> : Skip currently playing tts message

# Chat Commands

Enter in your twitch chat to perform these commands

-   `!ttsskip` : Skip currently playing tts message
-   `!ttsnick {username} {nickname}` : Give a user a nickname, nicknames can be multiple words (Nicknames are stored in %USERPROFILE%/twitch-tts/nicknames.json)
-   `!ttsreplace {acronym} {replacement}` : Give an acronym a long form word (Nicknames are stored in %USERPROFILE%/twitch-tts/replacement.json)
-   `!ttsjoin {username}` : to join another channel's chat
-   `!ttsleave {username}` : to leave another channel's chat

# Commands

Enter in the terminal window to perform these commands

-   `!resetconf` : to delete config file
-   `!nick {username} {nickname}` : Give a user a nickname, nicknames can be multiple words (Nicknames are stored in %USERPROFILE%/twitch-tts/nicknames.json)
-   `!replace {acronym} {replacement}` : Give an acronym a long form word (Nicknames are stored in %USERPROFILE%/twitch-tts/replacement.json)
-   `!read {text}` : read a test message to test tts
-   `!join {username}` : to join another channel's chat
-   `!leave {username}` : to leave another channel's chat
