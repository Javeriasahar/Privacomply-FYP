import { useState } from 'react'
import Popup from '@/pages/popup/Popup'
import Options from '@/pages/options/Options'
import SidePanel from '@/pages/sidepanel/SidePanel'

function App() {
  const [view, setView] = useState<'popup' | 'options' | 'sidepanel'>('popup')

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
       <div className="bg-white border-b sticky top-0 z-50 px-4 py-2 flex items-center justify-center gap-4 shadow-sm">
          <span className="text-sm font-medium text-gray-500 mr-2">Dev Preview:</span>
          <button 
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${view === 'popup' ? 'bg-primary text-primary-foreground' : 'hover:bg-gray-100'}`}
            onClick={() => setView('popup')}
          >
            Popup
          </button>
          <button 
             className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${view === 'options' ? 'bg-primary text-primary-foreground' : 'hover:bg-gray-100'}`}
             onClick={() => setView('options')}
          >
            Options
          </button>
          <button 
             className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${view === 'sidepanel' ? 'bg-primary text-primary-foreground' : 'hover:bg-gray-100'}`}
             onClick={() => setView('sidepanel')}
          >
            Side Panel
          </button>
       </div>
       
       <div className="flex-1 flex justify-center p-8 overflow-auto">
          {view === 'popup' && (
            <div className="shadow-2xl rounded-xl overflow-hidden border border-gray-200">
               <Popup />
            </div>
          )}
          {view === 'options' && (
             <div className="w-full max-w-7xl shadow-xl rounded-xl overflow-hidden border border-gray-200 bg-white">
               <Options />
             </div>
          )}
           {view === 'sidepanel' && (
             <div className="w-[400px] h-[600px] shadow-2xl rounded-xl overflow-hidden border border-gray-200">
               <SidePanel />
             </div>
          )}
       </div>
    </div>
  )
}

export default App
