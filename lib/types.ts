export type AssetClass = "idx_equity" | "us_equity" | "crypto" | "fx" | "other";
export type BookType = "investing" | "idx_trading" | "crypto_trading" | "other";
export type TradeDirection = "LONG" | "SHORT";
export type TradeResult = "WIN" | "LOSS" | "BE" | "OPEN";
export type AlertType = "price_above" | "price_below" | "pnl_pct" | "pnl_abs";
export type Severity = "info" | "warning" | "critical";
export type BookFilter = "all" | BookType;

export interface Trade {
  id: string;
  user_id: string;
  trade_date: string;
  asset_type: string;
  asset_class: AssetClass;
  ticker: string;
  direction: TradeDirection;
  strategy: string | null;
  book: BookType;
  entry_price: number;
  exit_price: number | null;
  leverage: number;
  position_size: number;
  stop_loss: number | null;
  take_profit: number | null;
  pnl_native: number | null;
  pnl_currency: "IDR" | "USD";
  pnl_pct: number | null;
  rr_ratio: number | null;
  result: TradeResult | null;
  hold_time_hours: number | null;
  commission_native: number | null;
  net_pnl_native: number | null;
  fx_rate_to_idr: number | null;
  mood: number | null;
  confidence: string | null;
  conviction: string | null;
  mistakes: string | null;
  notes: string | null;
  source_sheet_row_id: string;
  synced_at: string;
}

export interface OpenPosition {
  user_id: string;
  ticker: string;
  asset_class: AssetClass;
  book: BookType;
  net_qty: number;
  avg_entry: number;
  stop_loss: number | null;
  take_profit: number | null;
  pnl_currency: "IDR" | "USD";
  fx_rate_to_idr: number | null;
  opened_at: string;
  leg_count: number;
}

export interface LivePosition extends OpenPosition {
  last_price: number;
  last_price_currency: "IDR" | "USD";
  market_value_idr: number;
  cost_idr: number;
  unrealized_pnl_idr: number;
  unrealized_pnl_pct: number;
  day_change_pct: number;
  beta: number;
  pct_of_nav: number;
}

export interface AgentSignal {
  id: string;
  agent_slug: string;
  signal_type: string;
  ticker: string | null;
  severity: Severity;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  acknowledged: boolean;
}
