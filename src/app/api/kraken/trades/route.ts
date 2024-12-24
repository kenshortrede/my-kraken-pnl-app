// src/app/api/kraken/trades/route.ts
import { NextResponse } from 'next/server';
import KrakenClient from 'kraken-api';

interface OrderData {
  descr: {
    pair: string;
    type: string; // "buy" or "sell"
  };
  vol_exec: string;
  cost: string;
  fee: string;
  price: string;
  closetm: number;
}

export async function GET() {
    try {
      const { KRAKEN_API_KEY, KRAKEN_API_SECRET } = process.env;
      const kraken = new KrakenClient(KRAKEN_API_KEY, KRAKEN_API_SECRET);
  
      const start = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);
      const end = Math.floor(Date.now() / 1000);
  
      let allClosedOrders = {};
      let offset = 0;
      let moreData = true;
  
      while (moreData) {
        const response = await kraken.api('ClosedOrders', {
          start,
          end,
          ofs: offset,
        });
        const closedOrders = response.result?.closed || {};
        allClosedOrders = { ...allClosedOrders, ...closedOrders };
  
        moreData = Object.keys(closedOrders).length > 0;
        offset += Object.keys(closedOrders).length;
      }
  
      const trades = Object.entries(allClosedOrders).map(([orderId, orderData]) => ({
        orderId,
        pair: orderData.descr.pair,
        type: orderData.descr.type,
        volume: parseFloat(orderData.vol_exec),
        cost: parseFloat(orderData.cost),
        fee: parseFloat(orderData.fee),
        price: parseFloat(orderData.price),
        closeTime: orderData.closetm,
      }));
  
      const groupedByPair = trades.reduce((acc, t) => {
        acc[t.pair] = acc[t.pair] || [];
        acc[t.pair].push(t);
        return acc;
      }, {});
  
      const pairList = Object.keys(groupedByPair);
      const pairsString = pairList.join(',');
      const tickerResponse = await kraken.api('Ticker', { pair: pairsString });
      const tickerData = tickerResponse.result;
  
      return NextResponse.json({
        success: true,
        data: {
          trades,
          groupedByPair,
          tickerData,
        },
      });
    } catch (error: any) {
      console.error(error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
  }
  
