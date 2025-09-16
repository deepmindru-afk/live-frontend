Page: /login

Use:
- mutation login(email, password) -> { token, member{_id,displayName,systemRole} }
- query me (after login to redirect if already authed)

Behavior:
- Form: email, password, submit.
- On success: save JWT (localStorage "jwt"), redirect to "/".
- Errors: SweetAlert2 popup.
- "회원 가입" link -> /signup.
