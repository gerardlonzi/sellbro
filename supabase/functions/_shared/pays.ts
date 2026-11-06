// Pays supportés → devise de facturation. Miroir de lib/currency/taux.ts
// (DEVISES_PAR_PAYS) — à garder synchronisé.
export const DEVISE_PAR_PAYS: Record<string, string> = {
  BF: "XOF", BJ: "XOF", CD: "CDF", CI: "XOF", CM: "XAF", GH: "GHS",
  GN: "GNF", KE: "KES", ML: "XOF", MW: "MWK", NE: "XOF", NG: "NGN",
  RW: "RWF", SN: "XOF", TG: "XOF", TZ: "TZS", UG: "UGX", ZM: "ZMW",
};

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
