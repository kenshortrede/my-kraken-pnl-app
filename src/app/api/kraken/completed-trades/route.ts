import { NextResponse } from 'next/server';
import KrakenClient from 'kraken-api';

interface Trade {
  orderId: string;
  pair: string;
  type: string; // "buy" or "sell"
  volume: number;
  price: number;
  closeTime: number;
}

const calculateSequentialCompletedTrades = (trades: Trade[]) => {
  const completedTrades = [];
  const ongoingTrades = [];

  const tradeGroups: Record<string, Trade[]> = {};

  // Group trades by pair
  trades.forEach((trade) => {
    const { pair } = trade;
    if (!tradeGroups[pair]) {
      tradeGroups[pair] = [];
    }
    tradeGroups[pair].push(trade);
  });

  Object.keys(tradeGroups).forEach((pair) => {
    const pairTrades = tradeGroups[pair].sort((a, b) => a.closeTime - b.closeTime); // Sort by time
    let currentBuyVolume = 0;
    let currentBuyTrades: Trade[] = [];
    let currentSellVolume = 0;

    pairTrades.forEach((trade) => {
      if (trade.type === "buy") {
        currentBuyVolume += trade.volume;
        currentBuyTrades.push(trade);
      } else if (trade.type === "sell") {
        currentSellVolume += trade.volume;

        while (currentSellVolume > 0 && currentBuyVolume > 0) {
          const firstBuy = currentBuyTrades[0];

          if (currentSellVolume >= firstBuy.volume) {
            // Fully consume this buy
            currentSellVolume -= firstBuy.volume;
            currentBuyVolume -= firstBuy.volume;
            currentBuyTrades.shift(); // Remove this buy from the queue
          } else {
            // Partially consume this buy
            firstBuy.volume -= currentSellVolume;
            currentBuyVolume -= currentSellVolume;
            currentSellVolume = 0;
          }

          if (currentSellVolume === 0 && currentBuyVolume === 0) {
            // Completed trade
            completedTrades.push({
              pair,
              trades: [...currentBuyTrades, trade],
              profit: calculateProfit([...currentBuyTrades, trade]),
              endDate: trade.closeTime,
            });

            currentBuyTrades = [];
          }
        }
      }
    });

    if (currentBuyTrades.length > 0) {
      ongoingTrades.push(...currentBuyTrades);
    }
  });

  return { completedTrades, ongoingTrades };
};

const calculateProfit = (tradeSet: Trade[]) => {
  const buyVolume = tradeSet
    .filter((t) => t.type === "buy")
    .reduce((acc, t) => acc + t.volume * t.price, 0);
  const sellVolume = tradeSet
    .filter((t) => t.type === "sell")
    .reduce((acc, t) => acc + t.volume * t.price, 0);
  return sellVolume - buyVolume;
};

let lastNonce = Date.now() * 1000; // Initialize nonce based on current timestamp

const getNextNonce = () => {
  const newNonce = lastNonce + 1; // Increment nonce
  lastNonce = newNonce; // Update lastNonce
  return newNonce.toString();
};

export async function GET() {
    try {
      const { KRAKEN_API_KEY, KRAKEN_API_SECRET } = process.env;
      const kraken = new KrakenClient(KRAKEN_API_KEY, KRAKEN_API_SECRET);
  
      const start = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);
      const end = Math.floor(Date.now() / 1000);
  
      // Pass nonce explicitly
      const tradesResponse = await kraken.api('ClosedOrders', { start, end, nonce: getNextNonce() });
      const closedOrders = tradesResponse.result?.closed || {};
  
      const trades = Object.entries(closedOrders).map(([orderId, data]: [string, any]) => ({
        orderId,
        pair: data.descr.pair,
        type: data.descr.type,
        volume: parseFloat(data.vol_exec),
        price: parseFloat(data.price),
        closeTime: data.closetm,
      }));

    const { completedTrades, ongoingTrades } = calculateSequentialCompletedTrades(trades);

    return NextResponse.json({
        success: true,
        data: { /* completed trades data */ },
      });
    } catch (error: any) {
      console.error(error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
  }
