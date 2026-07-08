I’ll implement a focused fix with these changes:

1. **Add Custom Channel to every filtered picker**
   - When tapping Social Media, Email, or Text/SMS, the platform selection dialog will show that channel’s available platform icons.
   - At the bottom of each filtered selection screen, add an **Add Custom Channel** option that opens the existing custom channel form.
   - Keep the existing main/custom channel button behavior intact.

2. **Make platform selection support multiple additions**
   - Selecting a platform will add it to the campaign without immediately closing the selection dialog.
   - Already-added platforms will disappear or become unavailable so the user can add several platforms in one pass.

3. **Fix Facebook not opening Bundle.social**
   - Social platform selections like Facebook, Instagram, LinkedIn, Twitter/X, YouTube, and TikTok will open the Bundle.social connection modal instead of only adding a campaign platform row.
   - This will make Facebook behave like Instagram and Twitter/X with a **Connect Facebook via Bundle.social** action.

4. **Fix the Bundle.social reconnect error**
   - Update the backend connect-link function’s “already connected” recovery to use Bundle.social’s documented disconnect request shape: `DELETE /social-account/disconnect` with both `teamId` and `type`.
   - Then retry link creation once, so Twitter/X and Instagram can generate a fresh hosted connect URL instead of surfacing the 400 error.

5. **Reduce blocked embedded OAuth confusion**
   - Keep the connect link opening in a new top-level tab, but adjust the user-facing modal copy to make it clear the provider login must be completed in the opened browser tab/window and not inside the app dialog.

6. **Validate**
   - Confirm the Social Media picker shows the custom channel option at the bottom.
   - Confirm Facebook opens the Bundle.social connect modal.
   - Confirm the edge function no longer uses the incorrect disconnect request when Bundle.social reports an account is already connected.