# Polygon Studio

Polygon Studio jest edytorem wielokątów przechowującym scenę wyłącznie w pamięci. Interfejs oraz dokumentacja dostępna w aplikacji pod przyciskiem **Pomoc** zostały opracowane. Projekt realizuje wariant dla nazwisk rozpoczynających się na literę P: relacje prostopadłości krawędzi i domyślną ciągłość C1 dla sześciennych segmentów Béziera. Aplikacja nie obsługuje importu, eksportu ani zapisu do plików, nie korzysta również z pamięci lokalnej przeglądarki ani serwera aplikacyjnego.

## Przegląd bez żadnej instalacji
Nie trzeba nic pobierać ani żeby uruchomić program, ani by edytować kod:
- **Program online**: [mpiosik-gk1-proj1.vercel.app](https://mpiosik-gk1-proj1.vercel.app)
- **IDE online**: [StackBlitz](https://stackblitz.com/github/mpiosik-wut/gk1-proj1?startScript=dev)

## Przygotowanie środowiska — także bez zainstalowanego Node.js

Do zbudowania projektu potrzebne są Node.js, menedżer pakietów pnpm i dostęp do internetu w celu pobrania zależności. Zalecany jest **Node.js 24 LTS** oraz **pnpm 10.13.1**. Używane w projekcie Vite 7 wymaga Node.js 20.19+ lub 22.12+ (obsługuje również nowsze wersje); szczegóły znajdują się w [dokumentacji Vite 7](https://vite.dev/blog/announcing-vite7#node-js-support).

### 1. Instalacja Node.js

Jeżeli Node.js jest już zainstalowany w odpowiedniej wersji, można pominąć instalację i przejść do weryfikacji wersji zgodnie z poniższymi poleceniami.

- **Windows:** na [oficjalnej stronie Node.js](https://nodejs.org/en/download) należy wybrać wersję 24 LTS, system Windows oraz instalator `.msi` odpowiedni dla architektury komputera. Następnie należy uruchomić instalator, pozostawiając włączone opcje instalacji npm i dodania Node.js do `PATH`. Po zakończeniu instalacji należy ponownie otworzyć terminal (PowerShell lub Wiersz polecenia).
- **macOS:** z tej samej strony należy pobrać instalator `.pkg` wersji 24 LTS odpowiedni dla komputera i przeprowadzić instalację zgodnie z wyświetlanymi instrukcjami. Następnie należy ponownie otworzyć aplikację Terminal.
- **Linux:** na tej samej stronie należy wybrać wersję 24 LTS, system Linux oraz metodę instalacji, np. `nvm`. Następnie należy wykonać wyświetlone instrukcje w terminalu i otworzyć nową sesję terminala. W przypadku instalacji pakietu `nodejs` z repozytorium dystrybucji należy zweryfikować jego wersję, ponieważ może ona nie spełniać wymagań projektu.

Node.js dostarcza również npm, który służy do zainstalowania pnpm. W celu weryfikacji instalacji należy wykonać:

```sh
node --version
npm --version
```

Pierwsze polecenie powinno wyświetlić np. `v24.x.x`, a drugie numer wersji npm. Jeżeli polecenie nie jest rozpoznawane, należy ponownie otworzyć terminal i sprawdzić, czy Node.js został dodany do `PATH`.

### 2. Instalacja pnpm

W terminalu należy wykonać:

```sh
npm install --global pnpm@10.13.1
pnpm --version
```

Oczekiwany wynik drugiego polecenia to `10.13.1`. Więcej metod instalacji opisuje [oficjalna instrukcja pnpm](https://pnpm.io/installation).

Jeżeli instalacja globalna kończy się błędem uprawnień, można ją pominąć. W takim przypadku w dalszych poleceniach należy zastąpić `pnpm` przez `npx --yes pnpm@10.13.1`, np. `npx --yes pnpm@10.13.1 install --frozen-lockfile`.

## Pobranie zależności i uruchomienie

Należy pobrać kod projektu, np. w postaci archiwum ZIP, i rozpakować go albo sklonować repozytorium. Następnie należy otworzyć terminal w katalogu zawierającym `package.json` oraz `pnpm-lock.yaml`. Przejście do tego katalogu jest możliwe za pomocą polecenia `cd "ścieżka/do/GK1"`, po zastąpieniu przykładowej ścieżki rzeczywistą lokalizacją projektu.

W celu zainstalowania zależności w wersjach zapisanych w pliku blokady należy wykonać:

```sh
pnpm install --frozen-lockfile
```

Aby uruchomić serwer deweloperski, należy wykonać:

```sh
pnpm dev
```

Następnie należy otworzyć w przeglądarce adres wyświetlony w terminalu, domyślnie [http://localhost:5173](http://localhost:5173). Podczas korzystania z aplikacji terminal powinien pozostać uruchomiony. Zatrzymanie serwera następuje po użyciu skrótu **Ctrl+C**. Jeżeli port jest zajęty, Vite wybierze inny; wówczas należy skorzystać z adresu wyświetlonego w terminalu.

## Budowanie wersji produkcyjnej

Po zainstalowaniu zależności należy w tym samym katalogu wykonać:

```sh
pnpm build
```

Polecenie najpierw sprawdza typy TypeScript (`tsc --noEmit`), a następnie buduje aplikację za pomocą Vite. Gotowe pliki HTML, JavaScript i CSS trafiają do katalogu **`dist/`**.

W celu lokalnego sprawdzenia zbudowanej wersji należy wykonać:

```sh
pnpm preview
```

Następnie należy otworzyć adres wyświetlony w terminalu, domyślnie [http://localhost:4173](http://localhost:4173). Zatrzymanie podglądu następuje po użyciu skrótu **Ctrl+C**. Pliki aplikacji należy udostępniać za pomocą serwera HTTP; bezpośrednie otwarcie `dist/index.html` przez dwukrotne kliknięcie nie jest właściwą metodą uruchomienia. Do publikacji wystarczą pliki z `dist/` i hosting statyczny; na serwerze udostępniającym gotowe pliki Node.js nie jest wymagany.

Po zmianie kodu należy ponownie wykonać `pnpm build`, aby zaktualizować zawartość `dist/`. Polecenie `pnpm preview` służy do lokalnego sprawdzenia wyniku budowania.

## Scena demonstracyjna

Po uruchomieniu aplikacja zawiera cztery podpisane przykłady, rozmieszczone w dwóch rzędach:

- **Bézier · C1** — segment z równymi wektorami stycznymi na połączeniach, dwie ustalone długości (160 i 100 px) oraz prostopadłość. Górna krawędź ma jednocześnie długość i dwie relacje prostopadłości.
- **Bézier · G1** — zgodne kierunki stycznych przy różnych długościach wektorów. Lewa krawędź jest prostopadła do górnej krawędzi przykładu C1, co pokazuje relację między różnymi wielokątami (oznaczenie ⊥2).
- **Łuki · G1 i G0** — dwa górne łuki mają wspólną styczną w G1. Dolny łuk ma G0 na obu końcach i promień równy połowie długości cięciwy.
- **Samoprzecięcie** — wielokąt w kształcie kokardy, którego wierzchołki można przeciągać przez przecięcie.

Warto przeciągnąć punkty kontrolne obu Bézierów, wierzchołek G1 między łukami oraz końce krawędzi oznaczonych ⊥2. Grubości krzywych są celowo nieco większe, aby ułatwić porównanie trybów renderowania. Kolejny przykład można dodać w `src/geometry/demo.ts`, podając wierzchołki, opcjonalne kształty krawędzi oraz dopisując wielokąt do listy sceny. Odświeżenie strony przywraca demonstrację i usuwa wprowadzone zmiany.

Przycisk **Eksportuj** pobiera plik JSON ze sceną, relacjami, grubościami krawędzi i ustawieniami renderowania. **Otwórz** wyświetla systemowy wybór pliku JSON i zastępuje scenę po sprawdzeniu jego poprawności (maksymalnie 5 MB). Wczytanie sceny można cofnąć; historia i widok nie są zapisywane w pliku.

Nazwę pliku w nagłówku (domyślnie **Bez nazwy**) można zmienić, klikając ołówek **Edytuj**. Enter lub kliknięcie poza polem zatwierdza nazwę, a Escape anuluje edycję. Eksport pobiera `<nazwa>.json` i zapisuje nazwę również wewnątrz JSON-a. Otwieranie przywraca zapisaną nazwę, a dla starszych plików bez tego pola używa nazwy wybranego pliku.

## Obsługa

- **E — edycja:** w celu zmiany położenia wierzchołka lub kwadratowego punktu kontrolnego Béziera należy przeciągnąć go lewym przyciskiem myszy. Przeciągnięcie krawędzi lub wnętrza wielokąta przesuwa cały wielokąt.
- **N — nowy wielokąt:** należy wskazać kolejne punkty przez kliknięcie, a następnie nacisnąć Enter lub kliknąć pierwszy punkt, aby zamknąć wielokąt. Samoprzecięcia są dozwolone.
- **M — przesuwanie:** w celu przesunięcia całego wielokąta należy przeciągnąć dowolny jego element.
- **R — relacje:** w celu ustawienia prostopadłości należy wybrać dwie krawędzie. Możliwe jest również zaznaczanie z przytrzymanym klawiszem Shift, także między różnymi wielokątami.
- **F / kółko myszy:** dopasowanie widoku / zmiana przybliżenia.
- **Delete:** usunięcie zaznaczonego wierzchołka lub wielokąta.
- **Escape:** anulowanie rysowania i wyczyszczenie zaznaczenia.
- **Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z:** cofnięcie / ponowienie zmiany.

W celu zmiany typu krawędzi, podziału jej w połowie lub zmiany jej długości należy zaznaczyć daną krawędź. Ustawienie ciągłości wymaga zaznaczenia wierzchołka przylegającego do krzywej. Lista sceny umożliwia wybór poszczególnych wierzchołków i krawędzi, a pola liczbowe służą do zmiany współrzędnych wybranego punktu.

Każda zaznaczona krawędź ma pole **Grubość krawędzi (px)** z zakresem 1–50 px, zatwierdzane strzałką lub Enterem. Grubość pozostaje stała w pikselach ekranu podczas zmiany przybliżenia i działa w każdym trybie renderowania, również dla Béziera. Podział krawędzi zachowuje jej grubość w obu częściach. Usunięcie wierzchołka tworzy odcinek o grubości krawędzi wchodzącej.

Checkbox **Antialiasing Wu** działa niezależnie od wyboru algorytmu bibliotecznego/Bresenhama: wygładza odcinki i łuki, a Bézier korzysta z wybranego przyciskiem radiowym algorytmu. Wyłączenie checkboxa przywraca ten algorytm również dla odcinków i łuków.

Zaznaczenie krawędzi, również podczas wybierania pary do relacji, nadaje jej błękitny kolor i zwiększa widoczną grubość o 3 px względem własnego ustawienia. Odznaczenie przywraca zapisany kolor i grubość.

## Architektura i założenia

Plik `src/geometry/model.ts` definiuje niemutowalne typy sceny ze stałymi identyfikatorami wierzchołków i krawędzi. Operacje zmieniające topologię usuwają relacje wyłącznie dla zastępowanych krawędzi. Ograniczenia długości i prostopadłości dotyczą **cięciw łączących końce krawędzi**, również w przypadku krzywych. Ciągłość C1 segmentów sześciennych opiera się na pochodnych względem lokalnego parametru każdego segmentu z przedziału `[0,1]`; G1 wymaga zgodności znormalizowanych wektorów stycznych.

Algorytm rozwiązywania ograniczeń minimalizuje ich błędy za pomocą tłumionych poprawek o minimalnej normie, numerycznej macierzy Jacobiego i rozkładu Cholesky'ego dla układu dualnego. Przeciągany punkt pozostaje dokładnie w zadanej pozycji. Przy przeciąganiu punktu kontrolnego oba końce segmentu są początkowo unieruchomione; algorytm zwalnia je dopiero wtedy, gdy pierwsza próba nie pozwala spełnić relacji. Dla konfiguracji sprzecznych lub zdegenerowanych aplikacja zachowuje podgląd o skończonych współrzędnych i zgłasza błąd, zamiast samoczynnie przesuwać przeciągany punkt lub obniżać ciągłość.

Łuki są wyznaczane przez niejawny opis okręgu: G0/G0 daje półokrąg o promieniu równym połowie długości cięciwy, a jeden koniec G1 pozwala wyznaczyć okrąg na podstawie sąsiedniej stycznej. Drugi koniec musi mieć ciągłość G0. Współliniowe styczne o zgodnym zwrocie dają graniczny przypadek odcinka prostego. Dwa łuki połączone w wierzchołku G1 korzystają ze wspólnego okręgu przechodzącego przez ich trzy wierzchołki, co zapewnia dokładną wspólną styczną bez konstrukcji rekurencyjnej ani dodatkowych ograniczeń długości cięciw.

Rysowanie wykorzystuje natywne linie Canvas 2D lub własną całkowitoliczbową implementację algorytmu Bresenhama dla wszystkich oktantów, z obcinaniem metodą Lianga–Barsky'ego. Opcjonalny Wu interpoluje pokrycie sąsiednich pikseli, wypełnia wnętrze grubszych krawędzi i łączy pokrycie próbek łuku przed nałożeniem koloru. Własne rasteryzatory pracują w fizycznych pikselach również na ekranach HiDPI. Próbkowanie krzywych sześciennych wykorzystuje różnice progresywne w bazie potęgowej. TypeGPU inicjalizuje urządzenie WebGPU i nim zarządza, a urządzenie prezentuje zrasteryzowaną scenę jako teksturę. Algorytmy matematyczne działają na CPU, dzięki czemu tryby rasteryzacji można bezpośrednio porównywać. Przeglądarki bez WebGPU korzystają z tego samego wyniku Canvas 2D.

Pełna instrukcja obsługi oraz opis modelu danych i algorytmów są również dostępne w aplikacji pod przyciskiem **Pomoc**.
