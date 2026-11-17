---
title: A note on sidenotes and dates
description: A working example of every writing feature in this garden. Copy this note when you start a new one.
type: pattern
stage: budding
planted: 2026-11-10
tended: 2026-11-16
topics: [Meta, Writing]
---

This note is part demo, part cheat sheet. Open it in a text editor next to the page to see how each piece is written.

## Sidenotes

Write a footnote the normal Markdown way, with `[^name]` in the text and a line starting `[^name]:` anywhere below. On wide screens it appears in the margin beside the line it belongs to.[^margin] On a phone, tap the little number to open it inline.[^phone]

## Dates that show their age

Wrap a year or date in double curly braces, like `{{2015}}` or `{{2021-06-14}}`, and it gets a small badge saying how long ago it was. I moved into my first flat in {{2015}}, and planted this note on {{2026-11-10}}. The badges are worked out in the reader’s browser, so they stay accurate without rebuilding the site.

## Links between notes

Link to another note by putting its title or file name in double square brackets: `[[Welcome to the garden]]` becomes [[Welcome to the garden]]. You can change the link text with a pipe: `[[welcome-to-the-garden|the front door]]` becomes [[welcome-to-the-garden|the front door]].

Every note shows the other notes that link to it at the bottom, under *Linking here*.

Normal links work too, and they also get hover previews: here’s [my bookshelf](/books/), my [travel map](/travel/), and an outside link to [Maggie Appleton’s garden](https://maggieappleton.com/garden).

## Growth stages

Set `stage:` in the header to `seedling`, `budding` or `evergreen`, and `type:` to `note`, `essay`, `pattern` or `project`. Change `tended:` whenever you come back to edit.

[^margin]: Like this. Sidenotes can hold *formatting*, [links](/garden/) and dates like {{2020}} too.
[^phone]: On small screens sidenotes stay hidden until you tap them, so they don’t interrupt the reading.
