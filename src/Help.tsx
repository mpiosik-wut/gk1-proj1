export function Help() {
    return <article className="help-content">
        <p className="help-intro">Polygon Studio umożliwia tworzenie i edycję wielokątów z odcinkami, sześciennymi
            segmentami Béziera i łukami. Projekt realizuje wariant dla nazwisk rozpoczynających się na literę P:
            relacje prostopadłości krawędzi i domyślną ciągłość C1 dla segmentów Béziera.</p>
        <h3>Mysz i klawiatura</h3>
        <ul>
            <li><strong>E · Edycja:</strong> kliknięcie wierzchołka, punktu kontrolnego, krawędzi lub wnętrza
                wielokąta zaznacza dany element. W celu zmiany położenia punktu należy przeciągnąć go lewym
                przyciskiem myszy. Przeciągnięcie krawędzi lub wnętrza przesuwa cały wielokąt.
            </li>
            <li><strong>N · Nowy wielokąt:</strong> należy wskazać kolejne punkty przez kliknięcie. Kliknięcie
                pierwszego punktu lub Enter zamyka obrys. Samoprzecięcia są dozwolone. Escape anuluje tworzenie.
            </li>
            <li><strong>M · Przesuwanie:</strong> przeciągnięcie dowolnego elementu wielokąta przesuwa go w całości.</li>
            <li><strong>R · Relacje:</strong> w celu ustawienia prostopadłości należy wybrać dwie krawędzie,
                a następnie dodać relację w panelu. Możliwe jest również zaznaczanie z przytrzymanym klawiszem Shift,
                także między różnymi wielokątami.
            </li>
            <li><strong>Delete / Backspace:</strong> usunięcie wybranego wierzchołka lub całego wielokąta. Minimalna liczba
                wierzchołków to 3.
            </li>
            <li><strong>Ctrl/Cmd+Z:</strong> cofnięcie zmiany. <strong>Ctrl/Cmd+Shift+Z:</strong> ponowienie zmiany. Jeden gest przeciągania
                to jeden krok historii.
            </li>
            <li><strong>F:</strong> dopasowanie widoku. Kółko myszy zmienia przybliżenie wokół kursora.
                Escape usuwa zaznaczenie. Panel sceny umożliwia wybór poszczególnych wierzchołków i krawędzi.
            </li>
        </ul>
        <h3>Edycja i relacje</h3>
        <p>Wybrana krawędź może być odcinkiem, sześciennym segmentem Béziera lub łukiem. Bézier ma dwa kwadratowe punkty
            kontrolne i przerywany wielobok. Wybrany wierzchołek przy krzywej ma przełącznik ciągłości.</p>
        <p>Długość oznacza długość <strong>cięciwy</strong> między wierzchołkami również dla krzywych. Okno edycji
            przyjmuje jako wartość początkową aktualną długość. Prostopadłość dotyczy wektorów cięciw. Jedna krawędź
            może mieć długość i wiele relacji prostopadłości. Usuwanie relacji nie zmienia bieżącej geometrii.</p>
        <p>Podział krawędzi wstawia punkt dla parametru t = ½. Bézier jest dzielony metodą de Casteljau. Relacje
            zastępowanej krawędzi są usuwane. Usunięcie wierzchołka zastępuje jego dwie krawędzie odcinkiem i usuwa ich
            relacje; pozostałe identyfikatory krawędzi nie zmieniają się.</p>
        <h3>Ciągłość</h3>
        <ul>
            <li><strong>G0:</strong> wspólny koniec, bez wymagań dla stycznych.</li>
            <li><strong>G1:</strong> zgodne kierunki jednostkowych wektorów stycznych, bez wymogu tej samej długości.
            </li>
            <li><strong>C1:</strong> równe wektory pochodnych względem lokalnego parametru t ∈ [0,1]. Dla odcinka
                pochodna to B − A, dla Béziera na końcach: 3(C₁ − A) i 3(B − C₂).
            </li>
        </ul>
        <p>Nowy Bézier ustawia C1 na końcach, chyba że użytkownik wcześniej wybrał ciągłość jawnie. Łuk dopuszcza tylko
            G0/G1. Włączenie G1 na jednym końcu ustawia G0 na drugim. Bez G1 łuk jest półokręgiem o promieniu połowy
            cięciwy; przy G1 okrąg wynika z cięciwy i stycznej sąsiedniego segmentu. Dwa sąsiednie łuki z G1 korzystają
            ze wspólnego okręgu przechodzącego przez ich trzy wierzchołki.</p>
        <h3>Wygląd krawędzi i renderowanie</h3>
        <p>W celu zmiany grubości krawędzi należy ją zaznaczyć, wprowadzić wartość od 1 do 50 px i zatwierdzić
            strzałką lub Enterem. Grubość jest podawana w pikselach ekranu i działa dla odcinków, łuków i Béziera
            we wszystkich trybach. Podział zachowuje grubość w obu częściach; po usunięciu wierzchołka nowy odcinek
            dziedziczy grubość krawędzi wchodzącej.</p>
        <p>Zaznaczone krawędzie, również wybierane do relacji, mają błękitny kolor i są o 3 px grubsze od swojej
            ustawionej grubości. Odznaczenie przywraca ich zwykły wygląd.</p>
        <p>Pole wyboru <strong>Antialiasing Wu</strong> włącza wygładzanie odcinków i łuków przy obu ustawieniach
            algorytmu. Bézier korzysta z wybranego trybu bibliotecznego lub Bresenhama.</p>
        <h3>Scena demonstracyjna</h3>
        <p>Scena początkowa zawiera cztery przykłady: Béziera z C1, Béziera z G1, łuki z G1 i G0 oraz wielokąt
            z samoprzecięciem. Oznaczenie ⊥2 łączy krawędzie dwóch różnych wielokątów. Przeciąganie punktów
            kontrolnych umożliwia porównanie C1 i G1, a przesuwanie wspólnego wierzchołka G1 górnych łuków pozwala
            sprawdzić ich styczność. Odświeżenie strony przywraca demonstrację i usuwa wprowadzone zmiany.</p>
        <h3>Zapisywanie i otwieranie sceny</h3>
        <p>Przycisk <strong>Eksportuj</strong> zapisuje scenę i ustawienia renderowania do pliku JSON,
            a <strong>Otwórz</strong> wczytuje zapisany plik, zastępując scenę. Wczytanie można cofnąć.
            Nazwę pliku można zmienić przyciskiem <strong>Edytuj</strong> w nagłówku.</p>
        <h3>Model danych i architektura</h3>
        <p>Scena przechowuje listę wielokątów i osobną listę relacji. Wielokąt zawiera uporządkowane wierzchołki oraz
            krawędzie ze stabilnymi identyfikatorami. Krawędź odwołuje się do identyfikatorów swoich końców; wariant
            Béziera zawiera dwa punkty kontrolne, a łuk kierunek strony. Każda krawędź ma własną grubość. Wierzchołek przechowuje klasę ciągłości i
            informację, czy wybrano ją jawnie.</p>
        <p>Operacje topologiczne, funkcje krzywych, solver, rasteryzator i interfejs są osobnymi modułami. Stan i
            historia są przechowywane w pamięci. Pozycje są wyrażone w jednostkach sceny nazwanych pikselami;
            przybliżanie nie zmienia geometrii.</p>
        <h3>Algorytmy</h3>
        <p><strong>Solver:</strong> iteracyjne tłumione najmniejsze kwadraty z numerycznym Jacobianem. Reszty opisują
            długości, iloczyn skalarny znormalizowanych cięciw dla prostopadłości oraz różnice stycznych dla ciągłości.
            Pozycja przeciąganego punktu jest kotwicą i nie jest zmienną solvera. Przy ruchu punktu kontrolnego solver
            najpierw chroni wierzchołki jego segmentu; zwalnia je tylko, gdy relacje tego wymagają.</p>
        <p>Solver szuka niewielkich zmian geometrii. Układ sprzeczny lub zdegenerowany może nie mieć rozwiązania. Wtedy
            punkt nadal podąża za kursorem, a panel pokazuje błąd relacji zamiast ukrywać problem. Nie należy ustawiać
            zerowych długości ani stycznych. Współliniowa styczna łuku zgodna z cięciwą jest granicznym odcinkiem o
            nieskończonym promieniu.</p>
        <p><strong>Bézier:</strong> współczynniki bazy potęgowej są wyznaczane z czterech punktów. Kolejne punkty
            powstają przez dodawanie pierwszej, drugiej i trzeciej różnicy skończonej, bez ponownej ewaluacji
            wielomianu.</p>
        <p><strong>Odcinki:</strong> tryb biblioteczny używa CanvasRenderingContext2D. Własny Bresenham operuje na
            współrzędnych całkowitych we wszystkich oktantach. Przycięcie Liang–Barsky ogranicza pracę poza sceną.
            Antialiasing Wu rozdziela pokrycie między sąsiednie piksele; grubsze krawędzie mają pełne wnętrze i wygładzone
            brzegi. Próbki łuku łączą się przed nałożeniem koloru, aby uniknąć ciemnych szwów. Rasteryzacja uwzględnia gęstość
            pikseli ekranu. WebGPU przez TypeGPU prezentuje teksturę wynikową. Przy braku WebGPU działa
            ten sam rasteryzator Canvas 2D.</p>
    </article>;
}
