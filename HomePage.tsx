import React, { useState, useCallback } from 'react';
import App from './App'; // The existing App component will become the Create Monument Page
import MapPage from './MapPage'; // The new MapPage component

type AppView = 'map' | 'create';

const HomePage: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('map');

  const handleNavigateToMap = useCallback(() => {
    setCurrentView('map');
  }, []);

  const handleNavigateToCreate = useCallback(() => {
    setCurrentView('create');
  }, []);

  return (
    <div className="w-full h-screen">
      {currentView === 'map' ? (
        <MapPage onNavigateToCreate={handleNavigateToCreate} />
      ) : (
        <App onNavigateToMap={handleNavigateToMap} />
      )}
    </div>
  );
};

export default HomePage;