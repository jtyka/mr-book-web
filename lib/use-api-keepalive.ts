"use client";

import { useEffect } from "react";
import { BASE_URL } from "./api";

// Abstand zwischen zwei Pings – deutlich unter den üblichen Leerlauf-Timeouts
// von Edge, Proxy und NAT, damit die Verbindung gar nicht erst geschlossen wird.
const PING_INTERVAL_MS = 90_000;

/**
 * Hält die Verbindung zur API warm, solange `active` true ist (z. B. während
 * ein Formular-Dialog offen ist).
 *
 * Hintergrund: Wird über Minuten hinweg nichts angefragt, schließt die
 * Gegenseite die im Leerlauf liegende HTTP/2-Verbindung. Trifft der nächste
 * Request genau in dieses Fenster, scheitert er sofort mit
 * ERR_CONNECTION_CLOSED – so ging beim Eintippen eines Buches schon einmal der
 * komplette Formularinhalt verloren.
 *
 * Angefragt wird die statische Startseite der API: sie kommt aus dem
 * Edge-Cache und braucht weder Datenbank noch Anmeldung. `mode: "no-cors"`
 * spart die CORS-Prüfung (die Antwort interessiert nicht und soll keine
 * Konsolen-Fehler erzeugen), `cache: "no-store"` verhindert, dass der Browser
 * die Anfrage aus seinem eigenen Cache beantwortet und dabei gar keine
 * Verbindung benutzt.
 */
export function useApiKeepalive(active: boolean) {
  useEffect(() => {
    if (!active) return;

    // Bewusst roher fetch und nicht der API-Client: ein fehlgeschlagener Ping
    // darf weder eine Fehlermeldung anzeigen noch über den 401-Pfad zur
    // Anmeldeseite navigieren und dabei Eingaben verwerfen.
    const ping = () => {
      void fetch(`${BASE_URL}/`, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        credentials: "omit",
      }).catch(() => {});
    };

    const timer = setInterval(ping, PING_INTERVAL_MS);

    // Kommt der Tab aus dem Hintergrund zurück (Standby, Tab-Wechsel), ist die
    // Verbindung häufig schon tot. Ein Ping räumt sie aus dem Verbindungspool,
    // sodass der nächste echte Request eine frische Verbindung aufbaut.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [active]);
}
