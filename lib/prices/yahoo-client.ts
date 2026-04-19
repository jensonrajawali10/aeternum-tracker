import YahooFinance from "yahoo-finance2";

// yahoo-finance2 v3 requires instantiation — the static-style methods are typed `never`.
// Singleton so repeated imports share one client (connection pool, notice suppression).
export const yf = new YahooFinance();

// Silence the one-time yahooSurvey dev notice if the API exposes it on this version.
type NoticeSuppressor = { suppressNotices?: (keys: string[]) => void };
const notices = yf as unknown as NoticeSuppressor;
notices.suppressNotices?.(["yahooSurvey"]);
