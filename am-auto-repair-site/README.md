# AM Auto Repair Mobile — website

Single-page site (`index.html`). Open it in a browser. No build step.

## Photos (`images/`)
AI-generated with the AM logo:
- `hero-mechanic-van.jpg`: mechanic working under the hood, with the branded van in a customer's driveway
- `van-driveway.jpg`: van with its tool shelves open, parked at a home
- `mechanic-battery-office.jpg`: battery install in an office parking lot
- `brakes.jpg`: brake rotor and pad close-up for the $60 promo

## Quote requests
Every "Get a Quote" and "Book Appointment" button opens a 4-step form: vehicle → service → contact → send.
The last step builds a text message with all the details and opens the customer's texting app,
addressed to (301) 806-6217. There's also a "Copy request" button for desktop visitors, plus a call button.
To change the number, edit `SHOP_PHONE` at the top of the `<script>` in `index.html`.

## Reviews
Add real reviews to the `REVIEWS` list at the top of the `<script>`, for example:
`{ text: "Great service!", name: "Jessica R.", place: "Gaithersburg, MD", stars: 5 }`.
While the list is empty, the page shows a "reviews coming soon" card.
