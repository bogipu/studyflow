# StudyFlow – egyetlen 6 számjegyű PIN-kód az egész oldalhoz

1. A teljes ZIP tartalmát másold a GitHub `studyflow` repó gyökerébe, és telepítsd a Cloudflare Pages projektbe. Fontos: a `functions/_middleware.js` és a `functions/api/` mappák is kerüljenek fel. GitHub-alapú Pages telepítés szükséges a Functions működéséhez.
2. Cloudflare Pages projekt → Settings → Bindings: a meglévő `DB` mellett legyen külön D1 kötés `HEALTH_DB` néven, a privát napló adatbázisára. Ne töröld a `DB` kötést.
3. Settings → Variables and Secrets: két Secret szükséges: `HEALTH_PASSWORD` (pontosan 6 számjegyű PIN, például ne születési dátum vagy 123456) és `HEALTH_SESSION_SECRET` (legalább 32 karakter véletlen titok, külön a jelszótól). Generálás helyi terminálban: `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Ne küldd el őket senkinek és ne tedd GitHubra.
4. Új deployment után a kezdőlapnak a `/belepes.html` oldalra kell átirányítania. Egyszeri belépés után minden oldal elérhető, a jobb alsó gombbal kijelentkezhetsz. A munkamenet legfeljebb 7 napig él.
5. Az Egészség oldalon a korábbi napok a régi böngészőből, jóváhagyással importálhatók. Más eszközön a felhőben mentett napok jelennek meg.

## Fontos biztonsági határok
- Egy közös PIN-kód = egy közös napló. Bárki, aki tudja a jelszót, minden StudyFlow-oldalt és a naplót is láthatja.
- A belépés szerveroldali Pages middleware-ben történik; a `functions/api/` útvonalakat is védi. Ez nem csupán JavaScriptes felugró ablak.
- A munkamenet Secure, HttpOnly, SameSite=Strict cookie; a login IP-alapú próbálkozáskorlátozást használ.
- A Cloudflare Pages Functions útvonalait és a D1-kötést az éles környezetben külön ellenőrizni kell. Nem történt éles telepítés vagy böngészős integrációs teszt.
- Jelszócsere esetén a korábbi cookie-k érvényességének megszüntetéséhez cseréld a `HEALTH_SESSION_SECRET` értékét is.
- Az Egészség oldal korábbi külön belépési panelje a kódban kompatibilitási tartalékként megmaradt, de normál működésnél nem jelenik meg, mert már az egész StudyFlow védett.

## 6 számjegyű PIN biztonsága
- A `HEALTH_PASSWORD` értéke pontosan hat számjegy legyen, szóköz nélkül. A kezdő nulla is megengedett.
- Öt hibás kísérlet után a szerver 15 percre blokkolja a további belépési kísérleteket. A korlátozás IP-címenként és az egész oldalra közösen is érvényes; ezért idegenek szándékosan is okozhatnak ideiglenes belépési szünetet.
- A 6 számjegyű PIN gyengébb a hosszú jelszónál; ne oszd meg másokkal, és ne használd újra más szolgáltatásban.
- A szerver a PIN-t Cloudflare Secret változóban olvassa; ne írd bele a kódba.
- Az éles Cloudflare telepítés és a többeszközös működés itt nem lett kipróbálva.
