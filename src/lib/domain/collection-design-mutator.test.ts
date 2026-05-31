import { describe, expect, it } from 'vite-plus/test';
import { MetadataStandard } from '$lib/domain/metadata/metadata.strategy';
import {
	addLayer,
	addTrait,
	addTraitsBatch,
	removeLayer,
	removeTrait,
	reorderLayers,
	resetProject,
	replaceProject,
	setTraitType,
	toggleTraitType,
	updateLayer,
	updateLayerName,
	updateLayersBatch,
	updateProjectAnimationUrl,
	updateProjectCreators,
	updateProjectDescription,
	updateProjectDimensions,
	updateProjectExternalUrl,
	updateProjectMetadataStandard,
	updateProjectName,
	updateProjectPartial,
	updateProjectSellerFee,
	updateProjectSymbol,
	updateStrictPairConfig,
	updateTrait,
	updateTraitName,
	updateTraitRarity,
	updateTraitRulerRules,
	updateTraitsBatch
} from './collection-design-mutator';
import { unsafeCreateLayerId, unsafeCreateProjectId, unsafeCreateTraitId } from '$lib/types/ids';
import type { Layer, Trait } from '$lib/types/layer';
import type { Project } from '$lib/types/project';

function makeProject(): Project {
	return {
		id: unsafeCreateProjectId('p1'),
		name: 'Test',
		description: '',
		outputSize: { width: 100, height: 100 },
		layers: []
	};
}

function makeLayer(id = 'l1', name = 'Layer 1'): Layer {
	return {
		id: unsafeCreateLayerId(id),
		name,
		order: 0,
		traits: []
	};
}

function makeTrait(id = 't1', name = 'Trait 1'): Trait {
	return {
		id: unsafeCreateTraitId(id),
		name,
		imageData: new ArrayBuffer(0),
		rarityWeight: 5
	};
}

describe('CollectionDesignMutator — project metadata', () => {
	it('updateProjectName changes name and marks metadata dirty', () => {
		const project = makeProject();
		const result = updateProjectName(project, 'New Name');
		expect(result.changed).toBe(true);
		expect(result.dirtyMetadata).toBe(true);
		expect(result.dirtyLayers.size).toBe(0);
		expect(project.name).toBe('New Name');
	});

	it('updateProjectName returns unchanged when name is identical', () => {
		const project = makeProject();
		const result = updateProjectName(project, 'Test');
		expect(result.changed).toBe(false);
	});

	it('updateProjectDimensions detects no-op', () => {
		const project = makeProject();
		const result = updateProjectDimensions(project, { width: 100, height: 100 });
		expect(result.changed).toBe(false);
	});

	it('updateProjectDimensions applies change', () => {
		const project = makeProject();
		const result = updateProjectDimensions(project, { width: 512, height: 512 });
		expect(result.changed).toBe(true);
		expect(project.outputSize).toEqual({ width: 512, height: 512 });
	});

	it('updateProjectDescription, Symbol, SellerFee, ExternalUrl, AnimationUrl, MetadataStandard, Creators all mark metadata dirty', () => {
		const project = makeProject();
		expect(updateProjectDescription(project, 'desc').changed).toBe(true);
		expect(updateProjectSymbol(project, 'SYM').changed).toBe(true);
		expect(updateProjectSellerFee(project, 500).changed).toBe(true);
		expect(updateProjectExternalUrl(project, 'http://x').changed).toBe(true);
		expect(updateProjectAnimationUrl(project, 'http://y').changed).toBe(true);
		expect(updateProjectMetadataStandard(project, MetadataStandard.ERC721).changed).toBe(true);
		expect(updateProjectCreators(project, [{ address: 'a', share: 100 }]).changed).toBe(true);
	});
});

describe('CollectionDesignMutator — layers', () => {
	it('addLayer appends and returns the new layer', () => {
		const project = makeProject();
		const result = addLayer(project, 'Background');
		expect(result.changed).toBe(true);
		expect(result.layer?.name).toBe('Background');
		expect(project.layers).toHaveLength(1);
		expect(project.layers[0].order).toBe(0);
	});

	it('removeLayer removes layer and reorders', () => {
		const project = makeProject();
		project.layers = [makeLayer('a'), makeLayer('b'), makeLayer('c')];
		project.layers.forEach((l, i) => (l.order = i));

		const result = removeLayer(project, unsafeCreateLayerId('b'));
		expect(result.changed).toBe(true);
		expect(project.layers).toHaveLength(2);
		expect(project.layers.map((l) => l.id)).toEqual(['a', 'c']);
		expect(project.layers.map((l) => l.order)).toEqual([0, 1]);
	});

	it('removeLayer returns unchanged for missing layer', () => {
		const project = makeProject();
		const result = removeLayer(project, unsafeCreateLayerId('missing'));
		expect(result.changed).toBe(false);
	});

	it('updateLayerName changes name and marks layer dirty', () => {
		const project = makeProject();
		project.layers = [makeLayer('a', 'Old')];

		const result = updateLayerName(project, unsafeCreateLayerId('a'), 'New');
		expect(result.changed).toBe(true);
		expect(result.dirtyLayers.has(unsafeCreateLayerId('a'))).toBe(true);
		expect(project.layers[0].name).toBe('New');
	});

	it('updateLayerName no-ops for identical name', () => {
		const project = makeProject();
		project.layers = [makeLayer('a', 'Same')];
		const result = updateLayerName(project, unsafeCreateLayerId('a'), 'Same');
		expect(result.changed).toBe(false);
	});

	it('reorderLayers sets new order based on input array', () => {
		const project = makeProject();
		project.layers = [makeLayer('a'), makeLayer('b'), makeLayer('c')];

		const result = reorderLayers(project, [
			unsafeCreateLayerId('c'),
			unsafeCreateLayerId('a'),
			unsafeCreateLayerId('b')
		]);
		expect(result.changed).toBe(true);
		expect(project.layers.map((l) => l.id)).toEqual(['c', 'a', 'b']);
		expect(project.layers.map((l) => l.order)).toEqual([0, 1, 2]);
	});

	it('updateLayer applies partial updates', () => {
		const project = makeProject();
		project.layers = [makeLayer('a')];
		const result = updateLayer(project, unsafeCreateLayerId('a'), { isOptional: true });
		expect(result.changed).toBe(true);
		expect(project.layers[0].isOptional).toBe(true);
	});
});

describe('CollectionDesignMutator — traits', () => {
	it('addTrait creates trait under target layer', () => {
		const project = makeProject();
		project.layers = [makeLayer('a')];

		const result = addTrait(project, unsafeCreateLayerId('a'), {
			name: 'Red',
			imageData: new ArrayBuffer(8)
		});

		expect(result.changed).toBe(true);
		expect(result.trait?.name).toBe('Red');
		expect(result.trait?.rarityWeight).toBe(5);
		expect(project.layers[0].traits).toHaveLength(1);
	});

	it('addTrait returns unchanged for missing layer', () => {
		const project = makeProject();
		const result = addTrait(project, unsafeCreateLayerId('missing'), {
			name: 'X',
			imageData: new ArrayBuffer(0)
		});
		expect(result.changed).toBe(false);
		expect(result.trait).toBeUndefined();
	});

	it('removeTrait removes from layer', () => {
		const project = makeProject();
		const layer = makeLayer('a');
		layer.traits = [makeTrait('t1'), makeTrait('t2')];
		project.layers = [layer];

		const result = removeTrait(project, unsafeCreateLayerId('a'), unsafeCreateTraitId('t1'));
		expect(result.changed).toBe(true);
		expect(project.layers[0].traits.map((t) => t.id)).toEqual(['t2']);
	});

	it('updateTraitName, updateTraitRarity, updateTrait apply changes', () => {
		const project = makeProject();
		const layer = makeLayer('a');
		layer.traits = [makeTrait('t1', 'Old')];
		project.layers = [layer];

		expect(
			updateTraitName(project, unsafeCreateLayerId('a'), unsafeCreateTraitId('t1'), 'New').changed
		).toBe(true);
		expect(layer.traits[0].name).toBe('New');

		expect(
			updateTraitRarity(project, unsafeCreateLayerId('a'), unsafeCreateTraitId('t1'), 10).changed
		).toBe(true);
		expect(layer.traits[0].rarityWeight).toBe(10);

		expect(
			updateTrait(project, unsafeCreateLayerId('a'), unsafeCreateTraitId('t1'), {
				rarityWeight: 20
			}).changed
		).toBe(true);
		expect(layer.traits[0].rarityWeight).toBe(20);
	});

	it('updateTraitName no-ops for identical name', () => {
		const project = makeProject();
		const layer = makeLayer('a');
		layer.traits = [makeTrait('t1', 'Same')];
		project.layers = [layer];

		const result = updateTraitName(
			project,
			unsafeCreateLayerId('a'),
			unsafeCreateTraitId('t1'),
			'Same'
		);
		expect(result.changed).toBe(false);
	});
});

describe('CollectionDesignMutator — ruler traits', () => {
	it('setTraitType to ruler initializes empty rules', () => {
		const project = makeProject();
		const layer = makeLayer('a');
		layer.traits = [makeTrait('t1')];
		project.layers = [layer];

		const result = setTraitType(
			project,
			unsafeCreateLayerId('a'),
			unsafeCreateTraitId('t1'),
			'ruler'
		);
		expect(result.changed).toBe(true);
		expect(result.type).toBe('ruler');
		expect(layer.traits[0].type).toBe('ruler');
		expect(layer.traits[0].rulerRules).toEqual([]);
	});

	it('setTraitType to normal clears rules', () => {
		const project = makeProject();
		const layer = makeLayer('a');
		const trait = makeTrait('t1');
		trait.type = 'ruler';
		trait.rulerRules = [];
		layer.traits = [trait];
		project.layers = [layer];

		const result = setTraitType(
			project,
			unsafeCreateLayerId('a'),
			unsafeCreateTraitId('t1'),
			'normal'
		);
		expect(result.changed).toBe(true);
		expect(layer.traits[0].rulerRules).toBeUndefined();
	});

	it('setTraitType detects already-applied state', () => {
		const project = makeProject();
		const layer = makeLayer('a');
		const trait = makeTrait('t1');
		trait.type = 'ruler';
		trait.rulerRules = [];
		layer.traits = [trait];
		project.layers = [layer];

		const result = setTraitType(
			project,
			unsafeCreateLayerId('a'),
			unsafeCreateTraitId('t1'),
			'ruler'
		);
		expect(result.changed).toBe(false);
		expect(result.type).toBe('ruler');
	});

	it('toggleTraitType flips between normal and ruler', () => {
		const project = makeProject();
		const layer = makeLayer('a');
		layer.traits = [makeTrait('t1')];
		project.layers = [layer];

		const r1 = toggleTraitType(project, unsafeCreateLayerId('a'), unsafeCreateTraitId('t1'));
		expect(r1.type).toBe('ruler');

		const r2 = toggleTraitType(project, unsafeCreateLayerId('a'), unsafeCreateTraitId('t1'));
		expect(r2.type).toBe('normal');
	});

	it('updateTraitRulerRules sets rules and promotes to ruler type', () => {
		const project = makeProject();
		const layer = makeLayer('a');
		layer.traits = [makeTrait('t1')];
		project.layers = [layer];

		const rules = [
			{
				layerId: unsafeCreateLayerId('b'),
				allowedTraitIds: [unsafeCreateTraitId('x')],
				forbiddenTraitIds: []
			}
		];
		const result = updateTraitRulerRules(
			project,
			unsafeCreateLayerId('a'),
			unsafeCreateTraitId('t1'),
			rules
		);

		expect(result.changed).toBe(true);
		expect(layer.traits[0].type).toBe('ruler');
		expect(layer.traits[0].rulerRules).toHaveLength(1);
	});

	it('updateTraitRulerRules deduplicates and resolves conflicts in rule', () => {
		const project = makeProject();
		const layer = makeLayer('a');
		const trait = makeTrait('t1');
		trait.type = 'ruler';
		layer.traits = [trait];
		project.layers = [layer];

		const rules = [
			{
				layerId: unsafeCreateLayerId('b'),
				allowedTraitIds: [unsafeCreateTraitId('x'), unsafeCreateTraitId('x')],
				forbiddenTraitIds: [unsafeCreateTraitId('x'), unsafeCreateTraitId('y')]
			}
		];

		updateTraitRulerRules(project, unsafeCreateLayerId('a'), unsafeCreateTraitId('t1'), rules);

		expect(trait.rulerRules?.[0].allowedTraitIds).toEqual([unsafeCreateTraitId('x')]);
		expect(trait.rulerRules?.[0].forbiddenTraitIds).toEqual([unsafeCreateTraitId('y')]);
	});
});

describe('CollectionDesignMutator — batches', () => {
	it('updateTraitsBatch applies multiple trait updates', () => {
		const project = makeProject();
		const layerA = makeLayer('a');
		layerA.traits = [makeTrait('t1'), makeTrait('t2')];
		const layerB = makeLayer('b');
		layerB.traits = [makeTrait('t3')];
		project.layers = [layerA, layerB];

		const result = updateTraitsBatch(project, [
			{
				layerId: unsafeCreateLayerId('a'),
				traitId: unsafeCreateTraitId('t1'),
				updates: { rarityWeight: 1 }
			},
			{
				layerId: unsafeCreateLayerId('b'),
				traitId: unsafeCreateTraitId('t3'),
				updates: { rarityWeight: 9 }
			}
		]);

		expect(result.changed).toBe(true);
		expect(result.dirtyLayers.size).toBe(2);
		expect(layerA.traits[0].rarityWeight).toBe(1);
		expect(layerB.traits[0].rarityWeight).toBe(9);
	});

	it('updateLayersBatch applies multiple layer updates', () => {
		const project = makeProject();
		project.layers = [makeLayer('a'), makeLayer('b')];

		const result = updateLayersBatch(project, [
			{ layerId: unsafeCreateLayerId('a'), updates: { name: 'A2' } },
			{ layerId: unsafeCreateLayerId('b'), updates: { name: 'B2' } }
		]);

		expect(result.changed).toBe(true);
		expect(result.dirtyLayers.size).toBe(2);
		expect(project.layers.map((l) => l.name)).toEqual(['A2', 'B2']);
	});

	it('addTraitsBatch appends to layer', () => {
		const project = makeProject();
		project.layers = [makeLayer('a')];

		const result = addTraitsBatch(project, unsafeCreateLayerId('a'), [
			makeTrait('t1'),
			makeTrait('t2')
		]);

		expect(result.changed).toBe(true);
		expect(project.layers[0].traits).toHaveLength(2);
	});

	it('addTraitsBatch no-ops for empty list', () => {
		const project = makeProject();
		project.layers = [makeLayer('a')];
		const result = addTraitsBatch(project, unsafeCreateLayerId('a'), []);
		expect(result.changed).toBe(false);
	});
});

describe('CollectionDesignMutator — strict pair', () => {
	it('updateStrictPairConfig sets config', () => {
		const project = makeProject();
		const config = { enabled: true, layerCombinations: [] };
		const result = updateStrictPairConfig(project, project.id, config);
		expect(result.changed).toBe(true);
		expect(project.strictPairConfig).toEqual(config);
	});

	it('updateStrictPairConfig throws on ID mismatch', () => {
		const project = makeProject();
		expect(() =>
			updateStrictPairConfig(project, unsafeCreateProjectId('different'), {
				enabled: true,
				layerCombinations: []
			})
		).toThrow('Project ID mismatch');
	});
});

describe('CollectionDesignMutator — project replace/reset', () => {
	it('updateProjectPartial assigns updates and marks metadata dirty', () => {
		const project = makeProject();
		const result = updateProjectPartial(project, { name: 'X', description: 'Y' });
		expect(result.changed).toBe(true);
		expect(project.name).toBe('X');
		expect(project.description).toBe('Y');
	});

	it('replaceProject overwrites target with source and marks all layers dirty', () => {
		const target = makeProject();
		const source = makeProject();
		source.id = unsafeCreateProjectId('p2');
		source.name = 'Loaded';
		source.layers = [makeLayer('a'), makeLayer('b')];

		const result = replaceProject(target, source);

		expect(result.changed).toBe(true);
		expect(result.dirtyLayers.size).toBe(2);
		expect(target.id).toBe('p2');
		expect(target.name).toBe('Loaded');
		expect(target.layers).toHaveLength(2);
		expect(target._needsProperLoad).toBe(false);
	});

	it('resetProject restores defaults and clears layers', () => {
		const project = makeProject();
		project.layers = [makeLayer('a')];

		const defaults = makeProject();
		defaults.name = 'Default';

		resetProject(project, defaults);

		expect(project.name).toBe('Default');
		expect(project.layers).toEqual([]);
		expect(project._needsProperLoad).toBe(true);
	});
});
