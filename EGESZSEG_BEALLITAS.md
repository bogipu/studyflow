# StudyFlow Egészség ♡ – egyszerű, privát Cloudflare-beállítás

**FONTOS: a ZIP feltöltése önmagában nem kapcsolja be a felhős naplót.** A külön adatbázis és a titkos változók beállítása szükséges. Az adatok a beállításig a korábbi böngészőben maradnak; a program nem importál automatikusan.

1. A Cloudflare vezérlőpultban hozz létre egy **külön D1 adatbázist** például `studyflow-health-private` néven. A StudyFlow Pages projekt **Settings → Bindings** részén add hozzá `HEALTH_DB` néven. A meglévő `DB` kötést **ne módosítsd**.
2. A Pages projekt **Settings → Variables and Secrets** részén hozz létre két **titkos (Secret)** értéket, nem nyilvános változót:
   - `HEALTH_PASSWORD`: az általad választott **legalább 12 karakteres**, egyedi, erős jelszó.
   - `HEALTH_SESSION_SECRET`: legalább **32 karakteres véletlen**, kiszámíthatatlan titok. Generálható például helyi terminálban: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
   Ezeket **soha ne írd a forráskódba vagy a chatbe**. A jelszó titkos Cloudflare-változóban lesz, nem a D1 adatbázisban. A munkamenet titkos kulccsal aláírt, 7 napig érvényes HttpOnly/Secure/SameSite=Strict cookie.
3. Töltsd fel a teljes weboldal fájljait a GitHub-repóba / Cloudflare Pages-be, majd indíts új telepítést. A Pages Functions végpontok: `/api/health-login`, `/api/health-logout`, `/api/health-days`. A `functions/api/_health.js` közös segédfájl.
4. A friss weboldalon nyisd meg az Egészség oldalt, lépj be, jelölj be egy napot, frissítsd az oldalt, majd nézd meg másik eszközön is. A napok a külön D1 adatbázisba kerülnek, nem a közös plannerbe.
5. A **régi eszközödön, ugyanabban a böngészőben** jelentkezz be: megjelenik a „Korábbi napjaid átköltöztetése” rész. Az importálás csak a jóváhagyásoddal történik, a felhőben lévő napokhoz hozzáadva, ismétlődések nélkül. A helyi adatokat nem töröljük.

## Biztonsági tudnivalók
- Ez **egy közös, egyszerű jelszavas napló**, nem többfelhasználós fiókrendszer. Aki ismeri a jelszót, hozzáfér a naplóhoz. Ha megváltoztatod a `HEALTH_SESSION_SECRET` titkot, az összes korábbi belépés érvényét veszti.
- A bejelentkezési próbálkozásokat az IP-cím titkos kulccsal képzett lenyomata alapján 15 perces időablakban korlátozzuk. A korlát nem helyettesíti a Cloudflare WAF/Turnstile védelmet, ha a weboldal nyilvánosan nagy forgalmat kap.
- A napló nem végpontok között titkosított. A Cloudflare adminisztrátori hozzáférést érdemes kétlépcsős azonosítással védeni.
- A régi helyi adatok változatlanul megmaradnak, amíg te magad nem törlöd őket. Később külön export/mentés funkció ajánlott.
- A jelszó jelenleg Cloudflare Secret-ként van tárolva, nem hash-ként. Ez egy egyszerű egyfelhasználós konfigurációhoz működik, de egy későbbi fiókrendszerhez sózott, lassú jelszóhash-t és valódi szerveroldali munkamenet-tárolást érdemes bevezetni.
- **Nem történt éles Cloudflare-telepítés vagy D1-integrációs teszt.**
