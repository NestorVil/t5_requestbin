I have so many divs because i just copied the html for css purposes from rbaskets.in, I found out that all the names they used for their classes came from bootstrap so I npm installed bootstrapped and imported their css file. I used ai help for this because idk anything about styling.

My navbar is very skeleton like. We can decide if we actually want to add stuff to it as a group and assign someone the job of doing it.

Rbasket.in on their homepage automatically generates an id for you when you go to create a new basket like 235hhwg, and you can override this manually with a basket name of your choosing. I did not do this. Something to discuss and assign

After creating a basket on rbasket.in, a modal opens up saying the basket was successfully created with a token. I didn't make the modal and I don't think we need to configure the baskets in anyway right now so we may not need the token (we may need to generate one though to configure "forward_url" we have to ask chris about this.) If we dont then I was thinking we can just alert the user if that name for them was already taken and if not just redirect them to their new basket

I didnt set up a "services" or "communications" file in my frontend that makes all the API calls to the backend. In reality I think it wil be a call to get the info to display the list of baskets, and the glob of information per basket (await getHTTPRequests(basketSession) in the frontend and (SELECT * FROM basket_info. WHERE session_id = basketSession) or something like that). I think the hard part here is finding out what a websocket is (so when the backend changes aka a request gets added then the frontend somehow knows about it and updates)

I didnt set up the display info for whats in each basket (the "Full Basket" in our ERD).Figured someone can do that once we divide up the work.