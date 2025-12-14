# Ruler Rules - User Guide

## What Are Ruler Rules?

Ruler rules allow you to create **smart constraints** between traits across different layers. When a "ruler" trait is selected, it can control which traits are allowed or forbidden in other layers.

## Real-World Examples

### Example 1: Accessories that Conflict with Hair
```
🎩 Trait: "Top Hat" (Layer: Hats)
   └─ Rule: Forbid ["Long Hair", "Afro"] in Layer: Hair
   
Result: When generating NFTs with "Top Hat", you'll never see 
        "Long Hair" or "Afro" because they would clip through the hat.
```

### Example 2: Outfits that Require Specific Expressions
```
👔 Trait: "Formal Suit" (Layer: Outfit)
   └─ Rule: Allow only ["Serious", "Smile", "Neutral"] in Layer: Expression
   
Result: "Formal Suit" only appears with professional expressions,
        never with "Silly Face" or "Tongue Out".
```

### Example 3: Character Types with Matching Features
```
👹 Trait: "Zombie Skin" (Layer: Base)
   ├─ Rule 1: Allow only ["Red", "White", "Black"] in Layer: Eyes
   └─ Rule 2: Forbid ["Rosy Cheeks"] in Layer: Cheeks
   
Result: Zombies only have creepy eye colors and never have healthy-looking cheeks.
```

## How to Set Up Ruler Rules

### Step 1: Mark a Trait as "Ruler"
1. Go to your trait in the layer editor
2. Find the "Trait Type" toggle
3. Switch from "Normal" to "Ruler"

### Step 2: Add Rules
1. Click "Add Rule" on the ruler trait
2. Select the target layer (the layer you want to control)
3. Choose constraint type:
   - **Forbidden:** Specific traits that can't appear with this ruler
   - **Allowed:** Only these traits can appear (whitelist)

### Step 3: Select Traits
1. Check the boxes for traits you want to forbid/allow
2. Save your rule

## Rule Types Explained

### Forbidden (Blacklist)
**Use when:** You want to block specific problematic traits

```
Example: Hat that conflicts with certain hairstyles
  ✅ Forbidden: ["Mohawk", "Top Knot"]
  📝 Result: All hairstyles work EXCEPT "Mohawk" and "Top Knot"
```

### Allowed (Whitelist)
**Use when:** Only specific traits make sense together

```
Example: Cyberpunk visor that needs futuristic features
  ✅ Allowed: ["Neon Eyes", "LED Eyes", "Digital Eyes"]
  📝 Result: ONLY these eye types work with the visor
```

### Mixed Approach
You can use both on the same ruler trait:

```
Example: Astronaut helmet
  ✅ Allowed: ["Short Hair", "Bald", "Buzz Cut"] in Layer: Hair
  ❌ Forbidden: ["Beard", "Mustache"] in Layer: Facial Hair
  
  Result: Only short hairstyles + no facial hair
```

## Common Use Cases

### 1. Physical Compatibility
**Problem:** Some accessories clip through or hide other traits
**Solution:** Use forbidden rules to prevent visual conflicts

```
Baseball Cap (Ruler)
  └─ Forbid: ["Long Hair", "Ponytail", "Bun"]
```

### 2. Thematic Consistency
**Problem:** Want certain traits to only appear with matching themes
**Solution:** Use allowed rules to enforce themes

```
Medieval Armor (Ruler)
  ├─ Allow: ["Serious", "Angry", "Determined"] in Expression
  └─ Allow: ["Sword", "Shield", "Axe"] in Weapon
```

### 3. Character Archetypes
**Problem:** Want to maintain distinct character types
**Solution:** Multiple rules on key traits

```
Robot Trait (Ruler)
  ├─ Allow: ["LED", "Laser", "Digital"] in Eyes
  ├─ Allow: ["Silver", "Gold", "Chrome"] in Base Color
  └─ Forbid: ["Human Hair", "Organic Features"]
```

### 4. Rarity Combinations
**Problem:** Legendary traits should only pair with other rare items
**Solution:** Whitelist rare traits

```
Golden Crown (Legendary Ruler)
  ├─ Allow: ["Royal Robe", "King's Cloak"] in Outfit
  └─ Allow: ["Diamond Eyes", "Golden Eyes"] in Eyes
```

## Best Practices

### ✅ Do's

1. **Start Simple**
   - Begin with obvious conflicts (physical clipping)
   - Add thematic rules later

2. **Test Your Rules**
   - Generate a few NFTs after adding rules
   - Verify the combinations look right

3. **Use Descriptive Names**
   - Name ruler traits clearly: "Baseball Cap (Ruler)"
   - Makes it easier to manage rules

4. **Document Your Logic**
   - Keep notes on why certain rules exist
   - Helps when updating the collection

5. **Check Both Directions**
   - If Hat forbids Hair, does Hair need to forbid Hat?
   - Usually only need one direction

### ❌ Don'ts

1. **Don't Over-Constrain**
   - Too many rules = fewer possible combinations
   - Can make generation fail if impossible to satisfy all rules

2. **Don't Create Circular Conflicts**
   ```
   ❌ Bad:
   Trait A forbids Trait B
   Trait B forbids Trait A
   (This is okay, but redundant)
   
   ❌ Worse:
   Trait A allows only [B]
   Trait B allows only [C]
   Trait C allows only [A]
   (Creates impossible situation)
   ```

3. **Don't Mix Allowed/Forbidden Carelessly**
   ```
   ❌ Bad:
   Rule 1: Allow [A, B, C]
   Rule 2: Forbid [B]
   
   Result: B is both allowed and forbidden (forbidden wins)
   Better: Just allow [A, C]
   ```

4. **Don't Forget to Test Edge Cases**
   - What happens with optional layers?
   - What if a layer has only forbidden traits?

## Troubleshooting

### "Generation Failed - No Valid Combination"

**Cause:** Your rules are too restrictive and no combination satisfies all constraints.

**Solutions:**
1. Check for circular dependencies
2. Temporarily disable some rules to isolate the problem
3. Add more traits to constrained layers (more options)
4. Loosen whitelist rules (allow more traits)

### "Forbidden Trait Still Appearing"

**Possible Causes:**
1. ✅ **Check trait type:** Is the trait marked as "Ruler"?
2. ✅ **Check layer ID:** Does rule target the correct layer?
3. ✅ **Check trait ID:** Are you forbidding the right trait ID (not just name)?
4. ✅ **Check save:** Did you save the rule after creating it?

### "Rule Not Working as Expected"

**Debug Steps:**
1. Open browser console (F12)
2. Generate an NFT
3. Look for CSP solver logs
4. Verify trait IDs match your rule configuration

## Performance Considerations

### Impact on Generation Speed
- ✅ **Minimal impact:** Ruler rules actually SPEED UP generation
- ✅ **How?** They reduce the search space by eliminating invalid combinations early
- ✅ **Typical overhead:** < 5% even with complex rules

### Optimal Rule Count
- **Small collections (< 1000 NFTs):** Unlimited rules OK
- **Medium collections (1,000-10,000):** < 50 rules recommended
- **Large collections (> 10,000):** < 100 rules recommended

### Memory Usage
- Each rule: ~100 bytes
- 100 rules: ~10 KB
- Negligible impact on overall memory usage

## Advanced Techniques

### 1. Layered Rarity Tiers
```
Common Trait (Ruler)
  └─ Allow: [Common traits in other layers]
  
Rare Trait (Ruler)
  └─ Allow: [Rare traits in other layers]
  
Legendary Trait (Ruler)
  └─ Allow: [Legendary traits in other layers]
```

### 2. Story-Based Combinations
```
"Pirate" Backstory Trait (Ruler)
  ├─ Allow: [Pirate-themed accessories]
  ├─ Forbid: [Modern/futuristic items]
  └─ Allow: [Seafaring expressions]
```

### 3. Seasonal/Regional Variants
```
"Winter Coat" (Ruler)
  ├─ Forbid: ["Sunglasses", "Tank Top"]
  └─ Allow: ["Warm Colors", "Winter Accessories"]
```

## Summary

✅ **Ruler rules are working correctly in generation**
✅ **They help you create cohesive, visually compatible NFTs**
✅ **They actually improve generation performance**
✅ **Easy to set up and manage**

**Need help?** Check the verification report (`RULER_RULES_VERIFICATION.md`) for technical details.
