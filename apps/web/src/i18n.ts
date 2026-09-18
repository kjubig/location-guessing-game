import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  pl: {
    translation: {
      eyebrow: "Pierwszy przystanek: Korea Południowa",
      title: "Świat wygląda inaczej, kiedy musisz go rozpoznać.",
      description:
        "GEOLUKITUKI połączy obrazy satelitarne, układy metra i mapę do zgadywania w krótkie, pięciorundowe gry.",
      statusTitle: "Fundament M0",
      statusDescription:
        "Strona i Worker API mają wspólny proces budowania. Kolejny etap doda pierwszą grywalną rundę.",
      apiChecking: "Sprawdzam API…",
      apiOnline: "Worker API działa",
      apiOffline: "API uruchomi się razem z Workerem",
      flowTitle: "Jak działa serwis",
      browserTitle: "01 / Przeglądarka",
      browserText:
        "Wyświetla grę i wysyła strzał, ale nie zna poprawnej odpowiedzi.",
      workerTitle: "02 / Worker",
      workerText:
        "Przyjmuje żądania, pilnuje reguł i oblicza wynik blisko użytkownika.",
      databaseTitle: "03 / D1",
      databaseText:
        "Przechowuje rundy i ranking osobno dla produkcji i podglądów.",
      modesTitle: "Planowane tryby",
      satellite: "Miasto z góry",
      satelliteText:
        "Rozpoznaj miasto z kadru Sentinel-2 i wskaż środek obrazu.",
      metro: "Metro",
      metroText: "Rozpoznaj prawdziwy fragment sieci pokazany bez mapy i nazw.",
      docs: "Dokumentacja w repozytorium",
      footer: "M0 · architektura i pierwszy działający szkielet",
      language: "EN",
      theme: "Zmień motyw",
      playTitle: "Rozpoznasz Koreę z góry?",
      playDescription:
        "Pięć prawdziwych kadrów satelitarnych. Wskaż na mapie miejsce, które widzisz, i zdobądź do 5000 punktów za rundę.",
      nicknameLabel: "Twój nick",
      nicknamePlaceholder: "np. kjubig",
      startGame: "Rozpocznij grę",
      fiveRounds: "5 rund · maksymalnie 25 000 punktów",
      loading: "Chwila…",
      genericError: "Coś poszło nie tak",
      round: "Runda",
      satelliteAlt: "Satelitarny obraz miejsca do odgadnięcia",
      mapLoading: "Ładuję mapę…",
      guessMap: "Mapa zgadywania",
      confirmGuess: "Zatwierdź strzał",
      nextRound: "Następna runda",
      summary: "Zobacz podsumowanie",
      gameComplete: "Gra ukończona",
      playAgain: "Zagraj ponownie",
    },
  },
  en: {
    translation: {
      eyebrow: "First stop: South Korea",
      title: "The world looks different when you have to recognize it.",
      description:
        "GEOLUKITUKI will combine satellite imagery, metro geometry, and a guessing map in focused five-round games.",
      statusTitle: "M0 foundation",
      statusDescription:
        "The website and Worker API share one build pipeline. The next milestone adds the first playable round.",
      apiChecking: "Checking the API…",
      apiOnline: "Worker API is online",
      apiOffline: "The API starts together with the Worker",
      flowTitle: "How the service works",
      browserTitle: "01 / Browser",
      browserText:
        "Renders the game and sends a guess, but never knows the answer in advance.",
      workerTitle: "02 / Worker",
      workerText:
        "Handles requests, enforces game rules, and calculates scores close to the player.",
      databaseTitle: "03 / D1",
      databaseText:
        "Stores rounds and rankings separately for production and previews.",
      modesTitle: "Planned modes",
      satellite: "City from above",
      satelliteText:
        "Recognize a city from Sentinel-2 imagery and point to the crop center.",
      metro: "Metro",
      metroText:
        "Recognize a real network excerpt shown without a map or labels.",
      docs: "Documentation in the repository",
      footer: "M0 · architecture and the first working foundation",
      language: "PL",
      theme: "Change theme",
      playTitle: "Can you recognize Korea from above?",
      playDescription:
        "Five real satellite views. Point to the place on the map and earn up to 5000 points per round.",
      nicknameLabel: "Your nickname",
      nicknamePlaceholder: "e.g. kjubig",
      startGame: "Start game",
      fiveRounds: "5 rounds · up to 25,000 points",
      loading: "Please wait…",
      genericError: "Something went wrong",
      round: "Round",
      satelliteAlt: "Satellite view of a place to identify",
      mapLoading: "Loading map…",
      guessMap: "Guessing map",
      confirmGuess: "Confirm guess",
      nextRound: "Next round",
      summary: "View summary",
      gameComplete: "Game complete",
      playAgain: "Play again",
    },
  },
} as const;

await i18n.use(initReactI18next).init({
  fallbackLng: "pl",
  lng: "pl",
  resources,
  showSupportNotice: false,
  interpolation: { escapeValue: false },
});

export default i18n;
