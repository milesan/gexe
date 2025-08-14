# Simplified Inventory Calendar Logic

## The ONLY logic we need:

1. **Load all accommodations** from `accommodations` table
   - Each has an `id` and `title`
   - Some are unlimited (Van Parking, Your Own Tent, Staying with somebody)

2. **Load all accommodation items/tags** from `accommodation_items`
   - Each has an `accommodation_id` that points to which accommodation it belongs to
   - Each has a `full_tag` label like "C-BT.4-1" or "U-VC.van-1"

3. **Load all bookings** in the date range
   - Each booking has an `accommodation_id` (which accommodation type)
   - Each booking MAY have an `accommodation_item_id` (specific tag assigned)

4. **Create rows for display:**
   - Group by `accommodation_id` to create sections
   - For each accommodation:
     - If it has tags: create a row for each tag
     - If accommodation is unlimited: create dynamic rows for unassigned bookings
     - Row shows tag label if assigned, "?" if unassigned

5. **Display bookings in cells:**
   - For each cell (row + date):
     - If row has `item_id`: show bookings where `accommodation_item_id` matches
     - If row is dynamic ("?"): show unassigned bookings for that accommodation
     - Color: full opacity if assigned, muted if unassigned

## What's wrong now:
- We're checking `accommodation_title` instead of just using `accommodation_id`
- We're filtering by title strings instead of IDs
- We're making it complex with special cases

## The fix:
Use `accommodation_id` as the ONLY source of truth everywhere.