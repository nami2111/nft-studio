# Debug Ruler Rules - Step-by-Step Guide

## Issue
Ruler rules configuration is not being respected during NFT generation.

## Debug Logging Added

I've added debug logging to help diagnose the issue. When you generate NFTs now, you should see console messages like:

```
🎯 CSP Solver initialized with 3 ruler traits and 5 rules
```

And when rules are enforced:

```
❌ Ruler: "Baseball Cap" forbids "Long Hair"
❌ Ruler: "Formal Suit" only allows specific traits, "Silly Face" not in list
```

## Step-by-Step Debugging

### Step 1: Open Browser Console
1. Open your browser's Developer Tools (F12 or Ctrl+Shift+I / Cmd+Option+I)
2. Go to the "Console" tab
3. Clear any existing messages
4. Click "Generate" to start generation

### Step 2: Check Initialization
Look for the initialization message:

**Expected:**
```
🎯 CSP Solver initialized with X ruler traits and Y rules
```

**If you DON'T see this message:**
- Your ruler traits are not being saved correctly
- See "Troubleshooting" section below

**If you see "0 ruler traits":**
- The traits are not marked as type "ruler"
- Or the rulerRules array is empty
- See "Common Issues" section below

### Step 3: Check Rule Enforcement
As generation runs, watch for messages like:

```
❌ Ruler: "[TraitName]" forbids "[OtherTraitName]"
```

**If you see these messages:**
- ✅ Rules ARE being detected and enforced
- If wrong combinations still appear, the issue is with how you configured the rules
- Double-check your layer IDs and trait IDs

**If you DON'T see these messages:**
- Rules are not being triggered during constraint checking
- Could be a layer ID mismatch
- See "Troubleshooting" section below

### Step 4: Verify Output
Look at the generated NFTs:

**Check for forbidden combinations:**
- If you set "Hat A" to forbid "Hair B"
- Search the generated NFTs for any with both "Hat A" AND "Hair B"
- If you find any, the rules aren't working

**Check for allowed combinations:**
- If you set "Outfit A" to allow only ["Face 1", "Face 2"]
- Search for NFTs with "Outfit A" and any face other than "Face 1" or "Face 2"
- If you find any, the rules aren't working

## Common Issues

### Issue 1: Trait Not Marked as "Ruler"

**Symptom:** You see "0 ruler traits" in console

**Solution:**
1. Go to the layer containing your ruler trait
2. Find the trait in the trait list
3. Look for "Trait Type" toggle (should show "Normal" or "Ruler")
4. Click to switch to "Ruler"
5. Save your project
6. Try generating again

**How to verify:**
- The trait card should show a "Ruler" badge or indicator
- When you click on the trait, you should see "Ruler Rules" section

### Issue 2: Rules Not Saved

**Symptom:** Console shows "X ruler traits and 0 rules"

**Solution:**
1. Click on your ruler trait
2. Check if the "Ruler Rules" section is visible
3. Click "Add Rule"
4. Select target layer
5. Choose forbidden or allowed traits
6. **IMPORTANT:** Click "Save" or "Apply" button
7. Save your entire project
8. Reload the page and check if rules are still there

### Issue 3: Wrong Layer ID

**Symptom:** Rules show in console but aren't being enforced

**Cause:** The rule targets a layer ID that doesn't match any actual layer

**How to check:**
1. Open browser console
2. Type: `layers` (if available in scope)
3. Or add this temporary code to see layer IDs

**Solution:**
1. Delete the rule
2. Re-add it by selecting the layer from the dropdown
3. Don't manually type layer IDs

### Issue 4: Wrong Trait IDs

**Symptom:** Rules show but still allow forbidden combinations

**Cause:** The rule references trait IDs that don't match the actual traits

**How to check:**
In the console, when you see the rule enforcement message, check:
```
❌ Ruler: "Hat" forbids "Hair"
```

If this message appears but the combination still exists, the trait IDs in the rule don't match the actual trait IDs.

**Solution:**
1. Delete the rule
2. Re-add it by checking the trait checkboxes (don't manually enter IDs)
3. Save and test again

### Issue 5: Project Not Saved

**Symptom:** Rules work, then stop working after reload

**Solution:**
1. After setting up ruler rules, click "Save Project" or "Export Project"
2. If using browser storage, make sure to save explicitly
3. Reload and verify rules are still there before generating

## Manual Verification

### Check Trait Configuration
1. Export your project as a ZIP
2. Extract the `project.json` file
3. Open it in a text editor
4. Search for `"type": "ruler"`
5. Verify the trait has this property
6. Check that `rulerRules` array exists and has entries

**Example of correct configuration:**
```json
{
  "id": "trait_123",
  "name": "Baseball Cap",
  "type": "ruler",
  "rulerRules": [
    {
      "layerId": "layer_456",
      "allowedTraitIds": [],
      "forbiddenTraitIds": ["trait_789", "trait_012"]
    }
  ],
  "rarityWeight": 10
}
```

### Check Layer IDs Match
1. In the same `project.json`, find your layers
2. Note the `id` field for each layer
3. Verify that `layerId` in your rules matches actual layer IDs

**Example:**
```json
{
  "layers": [
    {
      "id": "layer_456",  // ← This ID
      "name": "Hair",
      "traits": [...]
    }
  ]
}

// In ruler rule:
{
  "layerId": "layer_456"  // ← Must match exactly
}
```

## Advanced Debugging

### Add Temporary Logging

If you're comfortable with code, you can add more detailed logging:

1. Open `src/lib/domain/project.domain.ts`
2. Find the `prepareLayersForWorker` function
3. Add this before the return statement:

```typescript
console.log('📦 Prepared layers for worker:', transferrableLayers.map(layer => ({
  name: layer.name,
  traits: layer.traits.map(trait => ({
    name: trait.name,
    type: trait.type,
    rulesCount: trait.rulerRules?.length || 0
  }))
})));
```

4. Save and reload
5. Generate NFTs and check the console

This will show you exactly what data is being sent to the worker.

### Check Worker Initialization

Add this to `src/lib/workers/generation.worker.ts` at line 1790 (after CSP solver creation):

```typescript
console.log('🔍 CSP Solver created with:', {
  layerCount: layers.length,
  layers: layers.map(l => ({
    name: l.name,
    rulerTraits: l.traits.filter(t => t.type === 'ruler').map(t => ({
      name: t.name,
      rulesCount: t.rulerRules?.length || 0,
      rules: t.rulerRules
    }))
  }))
});
```

## Expected Console Output

When everything is working correctly, you should see:

```
📦 Prepared layers for worker: [
  {
    name: "Hats",
    traits: [
      { name: "Baseball Cap", type: "ruler", rulesCount: 1 },
      { name: "Top Hat", type: "normal", rulesCount: 0 }
    ]
  },
  {
    name: "Hair",
    traits: [
      { name: "Long Hair", type: "normal", rulesCount: 0 },
      { name: "Short Hair", type: "normal", rulesCount: 0 }
    ]
  }
]

🎯 CSP Solver initialized with 1 ruler traits and 1 rules

❌ Ruler: "Baseball Cap" forbids "Long Hair"
❌ Ruler: "Baseball Cap" forbids "Long Hair"
... (multiple times during AC-3 pruning)
```

## Still Not Working?

If you've tried all the above and ruler rules still aren't working, please provide:

1. **Console output** - Copy ALL messages from the console during generation
2. **Project export** - Export your project as ZIP (we need to see the configuration)
3. **Screenshots** - Show the ruler rules UI where you configured them
4. **Expected vs Actual** - Describe what should happen vs what actually happens

### What to Include in Bug Report:

```
Browser: [Chrome/Firefox/Safari + version]
Operating System: [Windows/Mac/Linux]

Ruler Configuration:
- Layer: [Layer Name]
- Trait: [Trait Name]
- Rule Type: [Forbidden/Allowed]
- Target Layer: [Target Layer Name]
- Target Traits: [List of trait names]

Console Output:
[Paste console messages here]

Observed Behavior:
[What combinations are you seeing that shouldn't appear?]

Expected Behavior:
[What combinations should appear?]
```

## Quick Test Scenario

To test if ruler rules work at all:

1. Create a simple 2-layer collection:
   - Layer 1 "Color": Red, Blue, Green
   - Layer 2 "Shape": Circle, Square, Triangle

2. Make "Red" a ruler trait
3. Add a rule: Forbid "Square" in "Shape" layer
4. Generate 10 NFTs
5. Check results:
   - ✅ Should see: Red+Circle, Red+Triangle, Blue+Square, etc.
   - ❌ Should NEVER see: Red+Square

If this works, your ruler rules are functioning and the issue is with your specific configuration.

If this doesn't work, there's a deeper issue with the ruler rules system.

## Next Steps

After running the debugger with console output:

1. If you see "🎯 CSP Solver initialized with X ruler traits" → Rules are being loaded ✅
2. If you see "❌ Ruler: ..." messages → Rules are being enforced ✅
3. If rules are enforced but wrong combinations appear → Check your rule configuration ⚠️
4. If no ruler messages appear → Issue with data transfer, see "Common Issues" ❌

**Please share the console output with me so I can help diagnose the exact issue!**
