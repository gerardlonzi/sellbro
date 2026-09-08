import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export function useConnexion() {
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(Boolean(state.isConnected));
    });
    return () => unsubscribe();
  }, []);

  return isConnected;
}