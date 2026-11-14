import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { AppRoutes } from './App'
import { createQueryClient } from './app/queryClient'
import { RoleProvider } from './auth/RoleProvider'
import './styles/global.css'

const queryClient = createQueryClient()
const container = document.getElementById('root')
if (!container) throw new Error('index.html must have a #root element')

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RoleProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </RoleProvider>
    </QueryClientProvider>
  </StrictMode>,
)
