import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CLE_TOUR = "boutika_tour_termine";

export function useTourGuide() {
  const [afficherTour, setAfficherTour] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CLE_TOUR).then((valeur) => {
      if (valeur !== "true") setAfficherTour(true);
    });
  }, []);

  async function terminerTour() {
    await AsyncStorage.setItem(CLE_TOUR, "true");
    setAfficherTour(false);
  }

  return { afficherTour, terminerTour };
}