import type { PropsWithChildren } from 'react';
import { Provider } from '@/components/provider';
import '@/styles/globals.css';

async function RootElement({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body data-version="1.0">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}

export const getConfig = async () => {
  return {
    render: 'static'
  } as const;
};

export default RootElement;
