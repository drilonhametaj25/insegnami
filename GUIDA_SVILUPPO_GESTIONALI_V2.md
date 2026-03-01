# Guida Autonoma per Sviluppo CRM/ERP con Claude Code
## Versione 2.0 - Sistema Auto-Generativo

---

## ISTRUZIONI PER CLAUDE CODE

**Questa guida è progettata per essere data a Claude Code insieme alla descrizione del software desiderato.**

Claude Code deve:
1. Leggere questa guida COMPLETAMENTE prima di fare qualsiasi cosa
2. Auto-generare tutti i documenti architetturali necessari
3. Creare la lista di task sequenziali
4. Eseguire i task uno alla volta, validando dopo ognuno
5. MAI procedere al task successivo se quello corrente non funziona

---

## FASE 0: COMPRENSIONE DEL DOMINIO

### Prima di scrivere QUALSIASI codice o documento, Claude Code deve:

```
DOMANDE OBBLIGATORIE DA PORSI:

1. ENTITÀ PRINCIPALI
   - Quali sono le entità core del sistema?
   - Quali hanno relazioni 1:N, N:N, 1:1?
   - Quali sono le entità "master" (anagrafiche) vs "transazionali" (documenti)?

2. FLUSSI DI STATO
   - Ogni entità transazionale ha stati? Quali?
   - Quali transizioni sono permesse?
   - Cosa succede ad ogni transizione? (side-effects)

3. DIPENDENZE IMPLICITE
   - Se aggiungo X a Y, devo creare X da qualche parte?
   - Se modifico X, cosa si rompe?
   - Se elimino X, cosa diventa orfano?

4. REGOLE DI BUSINESS
   - Quali calcoli sono automatici?
   - Quali validazioni sono obbligatorie?
   - Quali azioni sono irreversibili?

5. INTEGRAZIONI
   - Fatturazione elettronica? (SDI per Italia)
   - Pagamenti?
   - Notifiche?
   - Report/export?
```

### Output della Fase 0:
Claude Code deve produrre un documento `DOMAIN_UNDERSTANDING.md` che risponde a TUTTE queste domande prima di procedere.

---

## FASE 1: GENERAZIONE DOCUMENTI ARCHITETTURALI

### Claude Code deve generare AUTOMATICAMENTE questi file nella cartella `/docs`:

### 1.1 ARCHITECTURE.md
```markdown
# [Nome Sistema] - Architettura

## Moduli del Sistema
Per ogni modulo:
- Nome e responsabilità
- Tabelle database possedute
- API/funzioni pubbliche esposte
- Dipendenze da altri moduli

## Grafo delle Dipendenze
[Diagramma testuale delle dipendenze]

## Flusso Dati Principale
[Descrizione del flusso principale del sistema]
```

### 1.2 DATA_MODEL.md
```markdown
# Modello Dati

## Entità Master (Anagrafiche)
Per ogni entità:
- Campi con tipi
- Relazioni
- Vincoli
- Indici

## Entità Transazionali (Documenti)
Per ogni entità:
- Campi con tipi
- Stati possibili
- Transizioni permesse
- Side-effects per transizione

## Regole di Integrità
- FK obbligatorie
- Vincoli di unicità
- Check constraints
```

### 1.3 BUSINESS_RULES.md
```markdown
# Regole di Business

## Invarianti (MAI violabili)
Regole che il sistema deve SEMPRE rispettare.

## Automazioni
Cosa succede automaticamente quando:
- Si crea un'entità
- Si modifica un'entità
- Si cambia stato
- Si elimina un'entità

## Calcoli
Formule e logiche di calcolo.

## Validazioni
Controlli da fare prima di ogni operazione.
```

### 1.4 STATE_MACHINES.md
```markdown
# Macchine a Stati

## [Nome Entità]
Stati: stato1 → stato2 → stato3

### Transizione: stato1 → stato2
- Condizioni: [cosa deve essere vera]
- Azioni: [cosa succede]
- Side-effects: [impatto su altre entità]
- Rollback: [come annullare se possibile]

[Ripetere per ogni transizione]
```

### 1.5 API_CONTRACTS.md
```markdown
# Contratti API

## Modulo [Nome]

### createEntity(data)
- Input: { campo1: tipo, campo2: tipo }
- Output: Entity
- Validazioni: [lista]
- Side-effects: [lista]
- Errori possibili: [lista]

[Ripetere per ogni funzione pubblica]
```

### 1.6 INTEGRATION_POINTS.md
```markdown
# Punti di Integrazione

## Dove i moduli si toccano

### [Modulo A] → [Modulo B]
- Quando: [trigger]
- Cosa passa: [dati]
- Cosa succede: [azione]
- Se fallisce: [gestione errore]
```

---

## FASE 2: GENERAZIONE STRUTTURA PROGETTO

### Claude Code deve creare questa struttura:

```
/src
  /types
    /shared
      index.ts          # Export centralizzato
      entities.ts       # Tutte le entità
      enums.ts          # Stati, tipi, ecc.
      common.ts         # ID, Timestamp, ecc.
    /schemas
      index.ts          # Zod schemas
  /modules
    /[modulo]
      index.ts          # Export pubblico
      service.ts        # Logica business
      repository.ts     # Accesso dati
      types.ts          # Tipi LOCALI (non condivisi)
      validators.ts     # Validazioni specifiche
      __tests__/        # Test del modulo
  /lib
    db.ts               # Connessione database
    errors.ts           # Errori custom
    utils.ts            # Utility condivise
  /hooks                # (se frontend)
  /components           # (se frontend)

/docs
  ARCHITECTURE.md
  DATA_MODEL.md
  BUSINESS_RULES.md
  STATE_MACHINES.md
  API_CONTRACTS.md
  INTEGRATION_POINTS.md

/tests
  /integration          # Test che attraversano moduli

CLAUDE.md               # Istruzioni per Claude Code
```

---

## FASE 3: GENERAZIONE CLAUDE.md

### Claude Code deve generare questo file nella root:

```markdown
# Istruzioni per Claude Code

## PRIMA DI OGNI TASK

### Leggi SEMPRE:
1. /docs/ARCHITECTURE.md - mappa del sistema
2. /docs/BUSINESS_RULES.md - regole inviolabili
3. /docs/STATE_MACHINES.md - se tocchi stati
4. /src/types/shared/index.ts - tipi esistenti

### Le 5 Domande Obbligatorie
Prima di scrivere codice, rispondi:

1. **LEGGO**: Quali file devo leggere per capire il contesto?
2. **TOCCO**: Quali file modificherò o creerò?
3. **USO**: Quali tipi/interfacce esistenti devo usare?
4. **ROMPO**: Quali moduli potrebbero rompersi?
5. **VERIFICO**: Come testerò che funziona tutto?

**ASPETTA CONFERMA PRIMA DI PROCEDERE**

## WORKFLOW OBBLIGATORIO

### STEP 1: ANALISI (no codice)
- Identifica entità coinvolte
- Verifica dipendenze
- Elenca side-effects
- Segnala ambiguità

### STEP 2: DESIGN (no codice)
- Proponi modifiche ai tipi
- Proponi schema DB
- Proponi API
- Aggiorna documentazione

**ASPETTA APPROVAZIONE**

### STEP 3: IMPLEMENTAZIONE
- Un file alla volta
- Usa tipi da /src/types/shared/
- Rispetta convenzioni
- Scrivi test

### STEP 4: VERIFICA
- TypeScript compila
- Test passano
- Moduli dipendenti OK

## REGOLE FERREE

### Mai fare:
- Creare tipi duplicati (usa shared/)
- Modificare più di 3 file senza conferma
- Saltare la fase di analisi
- Procedere se i test falliscono
- Ignorare i side-effects

### Sempre fare:
- Leggere i doc prima di ogni task
- Rispondere alle 5 domande
- Aggiornare la documentazione
- Scrivere test per nuove feature
- Verificare integrazioni

## GESTIONE ERRORI

Se qualcosa non funziona:
1. STOP - non continuare a fixare
2. Identifica la causa root
3. Verifica se hai violato una regola in BUSINESS_RULES.md
4. Proponi soluzione e aspetta conferma

## CONVENZIONI

### Naming
- camelCase: variabili, funzioni
- PascalCase: tipi, interfacce, classi
- kebab-case: file
- snake_case: database
- SCREAMING_CASE: costanti

### Import
```typescript
// ✅ CORRETTO
import { Customer, Invoice } from '@/types/shared';

// ❌ SBAGLIATO - mai ridefinire tipi esistenti
interface Customer { ... }
```

### Stati
```typescript
// ✅ CORRETTO - usa enum da shared
import { InvoiceStatus } from '@/types/shared/enums';

// ❌ SBAGLIATO - stringhe hardcoded
status: 'draft' | 'sent'
```
```

---

## FASE 4: GENERAZIONE TASK SEQUENZIALI

### Claude Code deve generare un file `TASKS.md`:

```markdown
# Task di Implementazione

## Ordine di Esecuzione
I task DEVONO essere eseguiti in questo ordine.
NON procedere al task successivo se quello corrente non funziona.

---

## TASK 1: Setup Progetto
**Prerequisiti**: Nessuno
**Output**: Struttura cartelle, dipendenze installate

Azioni:
1. Inizializza progetto (npm/pnpm)
2. Configura TypeScript strict
3. Installa dipendenze core
4. Crea struttura cartelle
5. Configura path aliases

**Verifica**: `npm run type-check` passa

---

## TASK 2: Tipi Condivisi
**Prerequisiti**: Task 1 completato
**Output**: /src/types/shared/ popolato

Azioni:
1. Crea entities.ts con tutte le entità
2. Crea enums.ts con tutti gli stati
3. Crea common.ts con tipi base
4. Crea index.ts che esporta tutto
5. Crea schemas Zod corrispondenti

**Verifica**: Import funzionano da qualsiasi file

---

## TASK 3: Database Schema
**Prerequisiti**: Task 2 completato
**Output**: Schema DB creato

Azioni:
1. Crea migrations/schema
2. Definisci tutte le tabelle
3. Definisci FK e vincoli
4. Esegui migration

**Verifica**: DB accessibile, tabelle esistono

---

## TASK 4+: Moduli (uno alla volta)
**Prerequisiti**: Task 3 + moduli dipendenti

Per OGNI modulo, in ordine di dipendenze:

### TASK 4.X: Modulo [Nome]

**Dipende da**: [lista moduli]

Azioni:
1. Crea cartella modulo
2. Implementa repository (CRUD base)
3. Implementa service (logica business)
4. Implementa validatori
5. Scrivi test unitari
6. Scrivi test integrazione con moduli dipendenti

**Verifica**:
- [ ] TypeScript compila
- [ ] Test unitari passano
- [ ] Test integrazione passano
- [ ] Import da altri moduli funziona

---

## TASK FINALE: Integrazione Completa

Azioni:
1. Verifica tutti i flussi end-to-end
2. Test di tutti i side-effects
3. Stress test delle transizioni di stato
4. Documentazione finale

**Verifica**: Sistema completo funzionante
```

---

## FASE 5: TEMPLATE PER RAGIONAMENTO AUTOMATICO

### Quando l'utente chiede una feature, Claude Code deve usare questo template:

```markdown
## Analisi Feature: [Nome Feature]

### 1. Comprensione
**Richiesta**: [cosa ha chiesto l'utente]
**Interpretazione**: [cosa significa nel dominio]

### 2. Entità Coinvolte
| Entità | Ruolo | Modifiche necessarie |
|--------|-------|---------------------|
| ...    | ...   | ...                 |

### 3. Impatto su Altri Moduli
| Modulo | Impatto | Azione richiesta |
|--------|---------|------------------|
| ...    | ...     | ...              |

### 4. Side-Effects Automatici
Quando questa feature viene usata:
1. [side-effect 1]
2. [side-effect 2]
...

### 5. Casi Edge da Gestire
- [ ] Cosa succede se [caso 1]?
- [ ] Cosa succede se [caso 2]?
...

### 6. Proposta Implementazione
1. [step 1]
2. [step 2]
...

### 7. Test da Scrivere
- [ ] Test: [descrizione]
- [ ] Test: [descrizione]
...

**ATTENDO CONFERMA PRIMA DI PROCEDERE**
```

---

## FASE 6: ESEMPIO PRATICO - EDILIZIAMI

### Input utente:
> "Voglio un gestionale per imprese edili con: preventivi, vendite, progetti, cantieri, SAL, materiali, veicoli"

### Output che Claude Code deve generare:

#### DOMAIN_UNDERSTANDING.md (estratto)
```markdown
## Entità Identificate

### Master (Anagrafiche)
- **Cliente**: chi commissiona i lavori
- **Materiale**: prodotti/materiali usati nei cantieri
- **Veicolo**: mezzi aziendali
- **Fornitore**: chi vende materiali
- **Dipendente**: chi lavora nei cantieri

### Transazionali (Documenti)
- **Preventivo**: offerta al cliente
- **Vendita**: contratto accettato
- **Progetto**: pianificazione lavori
- **Cantiere**: luogo fisico + gestione operativa
- **SAL**: Stato Avanzamento Lavori (fatturazione progressiva)
- **Ordine Materiale**: richiesta a fornitore
- **Assegnazione Veicolo**: prenotazione mezzo

## Flusso Principale
```
Preventivo (bozza → inviato → accettato/rifiutato)
    ↓ [se accettato]
Vendita (confermata)
    ↓ [automatico]
Progetto (pianificazione → attivo → completato)
    ↓ [automatico]
Cantiere (creato)
    ↓ [durante lavori]
├── SAL (bozza → presentato → approvato → fatturato)
├── Materiali (richiesti → ordinati → consegnati → usati)
└── Veicoli (prenotati → in uso → restituiti)
```

## Regole di Business Critiche

### Preventivo → Vendita
- Solo preventivo "accettato" genera vendita
- Copia TUTTE le righe preventivo in vendita
- Prezzi vendita = prezzi preventivo accettato

### Vendita → Progetto
- Automatico alla conferma vendita
- Budget progetto = totale vendita

### Progetto → Cantiere
- Automatico alla creazione progetto
- 1 Progetto = 1 Cantiere

### SAL
- Somma SAL ≤ Budget progetto
- SAL approvato genera fattura automatica
- Progetto chiudibile solo se Σ SAL = Budget

### Materiali
- Se materiale non esiste in anagrafica → chiedi se creare
- Assegnazione a cantiere scala giacenza
- Reso a magazzino ripristina giacenza

### Veicoli
- Verifica disponibilità per date
- No sovrapposizioni
- Calcolo automatico km/costi
```

#### TASKS.md (estratto)
```markdown
## Ordine Implementazione

1. Setup + Tipi condivisi
2. DB Schema
3. Modulo Auth (base per tutti)
4. Modulo Clienti (anagrafica, no dipendenze)
5. Modulo Materiali (anagrafica, no dipendenze)
6. Modulo Veicoli (anagrafica, no dipendenze)
7. Modulo Fornitori (anagrafica, no dipendenze)
8. Modulo Preventivi (dipende da: Clienti, Materiali)
9. Modulo Vendite (dipende da: Preventivi)
10. Modulo Progetti (dipende da: Vendite)
11. Modulo Cantieri (dipende da: Progetti)
12. Modulo SAL (dipende da: Cantieri, Progetti)
13. Modulo Ordini Materiale (dipende da: Cantieri, Materiali, Fornitori)
14. Modulo Assegnazione Veicoli (dipende da: Cantieri, Veicoli)
15. Modulo Fatturazione (dipende da: SAL, Clienti)
16. Integrazione e test E2E
```

---

## CHECKLIST FINALE PER CLAUDE CODE

Prima di considerare un task completato:

```
□ Ho letto i documenti in /docs/?
□ Ho risposto alle 5 domande?
□ Ho usato solo tipi da shared/?
□ Ho gestito tutti i side-effects?
□ Ho scritto i test?
□ TypeScript compila senza errori?
□ I test passano tutti?
□ I moduli dipendenti funzionano ancora?
□ Ho aggiornato la documentazione?
□ Ho segnalato ambiguità o problemi?
```

**Se anche UNA sola risposta è NO → non procedere al task successivo.**

---

## NOTE FINALI

Questa guida trasforma Claude Code da "esecutore di comandi" a "architetto di sistemi".

La chiave è:
1. **Capire PRIMA di fare** - la fase di analisi non è opzionale
2. **Documentare MENTRE fai** - i doc sono la memoria del sistema
3. **Verificare DOPO ogni step** - mai accumulare debito tecnico
4. **Fermarsi se qualcosa non va** - meglio chiedere che rompere

Il sistema risultante sarà:
- Coerente (tutti i moduli parlano la stessa lingua)
- Manutenibile (documentazione sempre aggiornata)
- Estensibile (nuovi moduli seguono lo stesso pattern)
- Testabile (ogni modulo ha i suoi test)
