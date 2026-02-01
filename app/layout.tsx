"use client";
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { useMemo } from 'react';
import { clusterApiUrl } from '@solana/web3.js';

// ボタンのデザインを読み込みます
import '@solana/wallet-adapter-react-ui/styles.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 開発用のテストネットワーク(Devnet)を使います
  const endpoint = useMemo(() => clusterApiUrl('devnet'), []);
  
  // Solflareを最優先でサポートするように設定します
  const wallets = useMemo(() => [new SolflareWalletAdapter()], []);

  return (
    <html lang="ja">
      <body>
        <ConnectionProvider endpoint={endpoint}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
              {children}
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </body>
    </html>
  );
}