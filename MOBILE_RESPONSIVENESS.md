# Mobile responsiveness

This checklist keeps the mobile work resumable. The intended baseline is a
320px-wide phone, with verification at 360px, 375px, 390px, 414px, 768px, and
1024px.

## Shared application shell

- [x] Make the persistent header use a responsive grid rather than desktop
  Bootstrap columns.
- [x] Keep navigation available on narrow screens with a horizontally
  scrollable action row and a full-width mobile search popover.
- [x] Make page jumbos stack breadcrumbs, contextual content, and actions on
  phones while preserving their stable desktop dimensions.
- [x] Collapse shared two- and three-column page layouts to one column.
- [x] Add phone-safe modal sizing, scrolling, and action wrapping.
- [x] Add touch-safe responsive rules for club, event, source, album, search,
  and map control layouts.

## Entity and content pages

- [ ] Verify and tune the mobile reading order for profile, club, event, and
  source pages.
- [ ] Verify item, stash, image-gallery, album, and arrow-placement flows on a
  touch device.
- [ ] Ensure search, filters, period selectors, and historical-year fields do
  not overflow at 320px.

## Dense pages

- [x] Collapse map controls into touch-safe groups without removing map
  capabilities.
- [ ] Tune library, administration, notification, wall, and chat views for
  small screens.

## Verification

- [ ] Run the UI build and typecheck.
- [ ] Test authenticated and unauthenticated flows at the documented viewport
  sizes, including keyboard focus, 200% zoom, and mobile Safari/Android touch.
