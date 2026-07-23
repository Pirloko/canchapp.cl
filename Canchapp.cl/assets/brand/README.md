# Marca Canchapp

Kit de logo oficial. Geometría: cancha (rectángulo + línea central + círculo) dentro de un anillo.

## Archivos

| Archivo | Uso |
|---------|-----|
| `canchapp-logo.svg` | Lockup horizontal (ícono + wordmark) sobre fondos claros |
| `canchapp-logo-oscuro.svg` | Lockup blanco sobre fondos oscuros / verdes |
| `canchapp-logo-icon.svg` | Solo ícono (trazo) |
| `canchapp-logo-icon-solid.svg` | Ícono relleno verde (favicons, avatares) |
| `canchapp-app-icon.svg` | Ícono de app cuadrado 1024 |

## Uso en código

```tsx
import { Logo } from '@/components/ui/Logo'

<Logo variant="light" size="md" withWordmark />
<Logo variant="dark" size="lg" withWordmark />  // sobre verde
<Logo variant="solid" size="sm" />              // badge relleno
```

Web estática: `/brand/canchapp-logo.svg`
