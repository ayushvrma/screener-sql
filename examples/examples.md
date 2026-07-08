# NL → Screener examples

| English | Screener query |
| --- | --- |
| market cap over 5000 crore, roe above 20 and debt to equity under 0.5 | `Market Capitalization > 5000 AND Return on equity > 20 AND Debt to equity < 0.5` |
| 5 year avg roe at least 15 and pledged percentage under 1 and profit growth 3years above 10 | `Average return on equity 5Years >= 15 AND Pledged percentage < 1 AND Profit growth 3Years > 10` |
| piotroski above 7 and altman z above 3 and g-factor at least 5 | `Piotroski score > 7 AND Altman Z Score > 3 AND G Factor >= 5` |
| current price below book value and promoter holding above 50 and pledged percentage equals 0 | `Current price < Book value AND Promoter holding > 50 AND Pledged percentage = 0` |
| 50 dma above 200 dma | `DMA 50 > DMA 200` |
| price between 100 and 300 and dividend yield above 1.5 and debt to equity under 0.5 | `Current price >= 100 AND Current price <= 300 AND Dividend yield > 1.5 AND Debt to equity < 0.5` |
