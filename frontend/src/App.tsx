import React from 'react';
import { Header } from './components/Header';
import { UsernameSearch } from './components/UsernameSearch';
import { UsernameLookup } from './components/UsernameLookup';
import { UsernameManage } from './components/UsernameManage';
import { Stats } from './components/Stats';
import { Footer } from './components/Footer';
import { CursorTracker } from './components/CursorTracker';

const App: React.FC = () => {
  return (
    <>
      <CursorTracker />
      <Header />
      <main>
        <UsernameSearch />
        <Stats />
        <UsernameLookup />
        <UsernameManage />
      </main>
      <Footer />
    </>
  );
};

export default App;

