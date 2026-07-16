# Tetris · terimix

Tetris retro (estilo CRT) en el navegador: modo solo, auto-bot, versus vs bot, **online P2P 1v1** y **coop 2v1** contra un boss bot.

**Jugar online:** [https://juanredgo.github.io/terimix.github.io/](https://juanredgo.github.io/terimix.github.io/)  
*(Si la URL de Pages es distinta, revisa *Settings → Pages* en el repo.)*

Repo: [github.com/juanredgo/terimix.github.io](https://github.com/juanredgo/terimix.github.io)

---

## Cómo jugar

Abre `index.html` en el navegador **o** usa el enlace de GitHub Pages. No hace falta instalar ni compilar nada.

| Modo | Descripción |
|------|-------------|
| **Solo** | Clásico infinito, ranking local, T-Spins, chiptune |
| **Auto** | El bot juega en tu tablero (espectador) |
| **Versus** | Tú vs bot local (Fácil / Normal / Difícil) |
| **Online** | 1v1 P2P con un amigo (código de sala de 6 dígitos) |
| **Coop 2v1** | Tú + amigo vs boss bot (solo el host simula al boss) |

### Controles

| Tecla | Acción |
|-------|--------|
| ← → | Mover |
| ↓ | Soft drop |
| ↑ / X | Girar horario |
| Z | Girar antihorario |
| Espacio | Hard drop |
| C / Shift | Hold |
| P / Esc | Pausa |
| V | Cambiar modo |
| M | Sonido |
| R | Ranking (fuera de partida) |

---

## Online / Coop (PeerJS)

1. Ambos eligen el **mismo modo** (Online o Coop).
2. Uno copia **su código de sala** y se lo pasa al otro.
3. El invitado pega el código y pulsa **Conectar** (o Enter).
4. Al conectar se hace un *handshake* de modo; el host arranca la partida.
5. Durante la partida verás **ping** y el estado de enlace.
6. Si se cae la red: el invitado puede **Reconectar**; el host espera.
7. Al terminar, si siguen conectados: **Revancha**.

### Detalles técnicos de red

- **PeerJS** (WebRTC data channels, `reliable: true`).
- Código de sala: ID de peer numérico de 6 dígitos.
- **Heartbeat** (ping/pong) + detección de timeout.
- **Basura** con IDs anti-duplicado (`sendGarbage`).
- **Sync de tablero** ~22 fps con **números de secuencia** (se ignoran paquetes viejos).
- Coop: host envía su asiento + boss; guest envía su asiento.

> Nota: los servidores públicos de PeerJS a veces fallan o tardan. Si no conecta, reintenta o cambia de red. NAT estricto / algunos móviles corporativos pueden bloquear WebRTC.

---

## Estructura del proyecto

```
index.html          UI (solo / versus / coop) + scripts
style.css           Tema CRT / paneles / online
js/
  constants.js      Tablero, piezas, kicks SRS, scores, bot diffs
  engine.js         Grid, colisiones, rotación, T-Spin, basura, puntos
  render.js         Canvas
  audio.js          SFX + chiptune
  fx.js             Partículas / banners / shake
  ranking.js        Top 10 local (localStorage)
  bot.js            Evaluación IA + Bot.createDriver()
  online.js         P2P, reconexión, sync, basura fiable
  main.js           Orquestación de modos, input, loop
```

Orden de carga: dependencias → `online.js` → `main.js`. Sin bundler; sirve con `file://` o Pages.

---

## Mejoras de red (resumen)

- Reconexión del invitado y reaceptación de enlace en el host  
- Ping visible (ok / warn / bad)  
- Mensajes `hello` / `start` / `game_over` / `rematch`  
- Comprobación de que ambos están en el mismo modo  
- Desconexión a mitad de partida cierra con overlay claro  
- Basura online/coop sin reaplicar el mismo ataque  

---

## Desarrollo local

```bash
# Opción simple: abrir index.html
# O servir estático:
npx --yes serve .
```

Para publicar en GitHub Pages: push a `main` con Pages apuntando a la raíz del repo (o la carpeta configurada).

---

## Créditos / stack

- HTML5 Canvas + Web Audio  
- [PeerJS](https://peerjs.com/) para P2P  
- Fuentes: Press Start 2P / VT323  

Hecho para divertirse. ¡A spamear Tetris y T-Spins!
