Page: /signup

Use:
- mutation signup(email, password, displayName) -> { token, member{...} }

Behavior:
- Form: displayName, email, password.
- On success: store JWT, redirect to "/".
- Errors: SweetAlert2 popup.
