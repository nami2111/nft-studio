import type { LayerId, TraitId } from '$lib/types/ids';
import type { RulerRule, Trait, TraitType } from '$lib/types/layer';
import type { Project } from '$lib/types/project';

export interface CollectionDesignEditResult {
	changed: boolean;
	dirtyLayerId?: LayerId;
}

export interface TraitTypeEditResult extends CollectionDesignEditResult {
	type?: TraitType;
}

function findTrait(project: Project, layerId: LayerId, traitId: TraitId): Trait | null {
	const layer = project.layers.find((projectLayer) => projectLayer.id === layerId);
	return layer?.traits.find((projectTrait) => projectTrait.id === traitId) ?? null;
}

function cloneRulerRules(rules: RulerRule[]): RulerRule[] {
	return rules.map((rule) => {
		const allowedTraitIds = [...new Set(rule.allowedTraitIds)];
		const forbiddenTraitIds = [...new Set(rule.forbiddenTraitIds)].filter(
			(traitId) => !allowedTraitIds.includes(traitId)
		);

		return {
			layerId: rule.layerId,
			allowedTraitIds,
			forbiddenTraitIds
		};
	});
}

function rulerRulesEqual(left: RulerRule[] | undefined, right: RulerRule[]): boolean {
	const normalizedLeft = cloneRulerRules(left ?? []);
	const normalizedRight = cloneRulerRules(right);

	return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

export function setTraitType(
	project: Project,
	layerId: LayerId,
	traitId: TraitId,
	type: TraitType
): TraitTypeEditResult {
	const trait = findTrait(project, layerId, traitId);
	if (!trait) return { changed: false };

	const currentType = trait.type ?? 'normal';
	const alreadyApplied =
		currentType === type &&
		((type === 'ruler' && trait.rulerRules !== undefined) ||
			(type === 'normal' && trait.rulerRules === undefined));

	if (alreadyApplied) {
		return { changed: false, type };
	}

	trait.type = type;
	trait.rulerRules = type === 'ruler' ? cloneRulerRules(trait.rulerRules ?? []) : undefined;

	return { changed: true, dirtyLayerId: layerId, type };
}

export function toggleTraitType(
	project: Project,
	layerId: LayerId,
	traitId: TraitId
): TraitTypeEditResult {
	const trait = findTrait(project, layerId, traitId);
	if (!trait) return { changed: false };

	const currentType = trait.type ?? 'normal';
	const nextType: TraitType = currentType === 'normal' ? 'ruler' : 'normal';
	return setTraitType(project, layerId, traitId, nextType);
}

export function updateTraitRulerRules(
	project: Project,
	layerId: LayerId,
	traitId: TraitId,
	rules: RulerRule[]
): CollectionDesignEditResult {
	const trait = findTrait(project, layerId, traitId);
	if (!trait) return { changed: false };

	const nextRules = cloneRulerRules(rules);
	const typeChanged = trait.type !== 'ruler';
	if (trait.type !== 'ruler') {
		trait.type = 'ruler';
	}

	if (rulerRulesEqual(trait.rulerRules, nextRules)) {
		return { changed: typeChanged, dirtyLayerId: typeChanged ? layerId : undefined };
	}

	trait.rulerRules = nextRules;
	return { changed: true, dirtyLayerId: layerId };
}
