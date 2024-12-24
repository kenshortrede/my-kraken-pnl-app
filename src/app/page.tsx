'use client';

import { useEffect, useState } from 'react';

type Trade = {
  orderId: string;
  pair: string;
  type: string; // "buy" | "sell"
  volume: number;
  cost: number;
  fee: number;
  price: number;
  closeTime: number;
};

type PairTradesMap = {
  [pair: string]: Trade[];
};

type TickerResult = {
  [pair: string]: {
    a: string[]; // ask data
    b: string[]; // bid data
    c: string[]; // last trade closed [price, lot volume]
  };
};

export default function DashboardPage() {
  const [groupedTrades, setGroupedTrades] = useState<PairTradesMap>({});
  const [tickerData, setTickerData] = useState<TickerResult>({});
  const [completedTrades, setCompletedTrades] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'all' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(viewMode === 'all' ? '/api/kraken/trades' : '/api/kraken/completed-trades');
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || 'Failed to fetch data');
        }

        if (viewMode === 'all') {
          const { groupedByPair, tickerData } = json.data;
          setGroupedTrades(groupedByPair);
          setTickerData(tickerData);
        } else {
          setCompletedTrades(json.data.completedTrades);
        }
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }
    fetchData();
  }, [viewMode]);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  if (viewMode === 'completed') {
    return (
      <div className="p-4 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Kraken Dashboard - Completed Trades</h1>
        <button onClick={() => setViewMode('all')} className="btn mb-4">Back to All Trades</button>
        {completedTrades.map((tradeGroup, index) => (
          <div key={index} className="border rounded p-4 mb-4">
            <h2 className="text-xl font-semibold">{tradeGroup.pair}</h2>
            <p>Profit: ${tradeGroup.profit.toFixed(2)}</p>
            <p>Completed on: {new Date(tradeGroup.endDate * 1000).toLocaleString()}</p>
            <ul>
              {tradeGroup.trades.map((trade, idx) => (
                <li key={idx}>
                  {trade.type.toUpperCase()} {trade.volume} @ ${trade.price.toFixed(2)} (Time: {new Date(trade.closeTime * 1000).toLocaleString()})
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  const btcPairKey = Object.keys(tickerData).find((key) => key.includes('XBT') && key.includes('USD'));
  const btcPrice = btcPairKey ? parseFloat(tickerData[btcPairKey]?.c[0]) : 0;

  const rows = Object.entries(groupedTrades).map(([pair, trades]) => {
    const buyTrades = trades.filter((t) => t.type === 'buy');
    const sellTrades = trades.filter((t) => t.type === 'sell');

    const totalBuyVolume = buyTrades.reduce((acc, t) => acc + t.volume, 0);
    const totalBuyCost = buyTrades.reduce((acc, t) => acc + t.cost, 0);

    const totalSellVolume = sellTrades.reduce((acc, t) => acc + t.volume, 0);
    const netVolume = totalBuyVolume - totalSellVolume;

    const avgPrice = totalBuyVolume > 0 ? totalBuyCost / totalBuyVolume : 0;

    const pairTicker = tickerData[pair];
    let currentPrice = 0;
    if (pairTicker) {
      currentPrice = parseFloat(pairTicker.c[0]);
    }

    const unrealizedPnL = netVolume * currentPrice - avgPrice * netVolume;

    const naiveBtcQty = btcPrice > 0 ? (avgPrice * netVolume) / btcPrice : 0;
    const altValueInUsd = netVolume * currentPrice;
    const btcValueInUsd = naiveBtcQty * btcPrice;
    const differenceVsBtc = altValueInUsd - btcValueInUsd;

    return {
      pair,
      netVolume,
      avgPrice,
      currentPrice,
      unrealizedPnL,
      differenceVsBtc,
    };
  });

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Kraken Dashboard</h1>
      <button onClick={() => setViewMode('completed')} className="btn mb-4">View Completed Trades</button>
      {btcPrice ? (
        <p className="mb-4">Current BTC Price (USD): <strong>${btcPrice.toFixed(2)}</strong></p>
      ) : (
        <p className="mb-4 text-red-500">BTC price not found in ticker data.</p>
      )}
      <table className="min-w-full border border-gray-300">
        <thead className="bg-gray-200">
          <tr>
            <th className="px-4 py-2 text-left">Pair</th>
            <th className="px-4 py-2 text-left">Net Volume</th>
            <th className="px-4 py-2 text-left">Avg Buy Price (USD)</th>
            <th className="px-4 py-2 text-left">Current Price (USD)</th>
            <th className="px-4 py-2 text-left">Unrealized PnL (USD)</th>
            <th className="px-4 py-2 text-left">vs BTC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.pair} className="border-b border-gray-200">
              <td className="px-4 py-2 font-semibold">{r.pair}</td>
              <td className="px-4 py-2">{r.netVolume.toFixed(4)}</td>
              <td className="px-4 py-2">${r.avgPrice.toFixed(2)}</td>
              <td className="px-4 py-2">${r.currentPrice.toFixed(2)}</td>
              <td
                className={`px-4 py-2 ${r.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                ${r.unrealizedPnL.toFixed(2)}
              </td>
              <td
                className={`px-4 py-2 ${r.differenceVsBtc >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {r.differenceVsBtc >= 0
                  ? `+${r.differenceVsBtc.toFixed(2)}`
                  : r.differenceVsBtc.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}