/**
 * Shared gallery utility functions
 */

export function getRarityColor(rank: number, total: number): string {
	const percentage = (rank / total) * 100;
	if (percentage <= 5) return 'bg-red-500 text-white';
	if (percentage <= 10) return 'bg-orange-500 text-white';
	if (percentage <= 25) return 'bg-yellow-500 text-black';
	if (percentage <= 50) return 'bg-green-500 text-white';
	return 'bg-blue-500 text-white';
}
