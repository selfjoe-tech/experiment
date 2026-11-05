# Extra JuicyAds placements in the shared ad rail

The existing Goongram ad rail uses the publisher zones `1130835` and `1130836`.

Two additional positions have been added to the **same horizontally scrolling rail**, which is used on Home, Reels, Explore, profiles, and Watch. To activate them, create two **new** JuicyAds zones with the same 308 × 2592 creative dimensions and set these Vercel environment variables:

```env
NEXT_PUBLIC_JUICYADS_EXTRA_ZONE_1=YOUR_FIRST_NEW_ZONE_ID
NEXT_PUBLIC_JUICYADS_EXTRA_ZONE_2=YOUR_SECOND_NEW_ZONE_ID
```

Use different positive numeric IDs for both. Do **not** reuse existing zones `1130835`, `1130836`, `1130841` or `1130842`: those IDs are already mounted in other placements on the same page.

After adding the environment variables for the relevant environment in Vercel, **redeploy** so they are included in the client bundle. Without configured IDs, slots 3 and 4 remain labeled advertising placeholders; they do not send vendor requests.

The rail's low-priority stacking context is preserved so the ads cannot cover menus, dialogs or search panels.
