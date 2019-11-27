package org.citopt.connde.service.deploy;

/**
 * Enumerates all possible availability states of processing operator instances.
 *
 * Semantics:
 * - Unknown: State is not known
 * - Stopped: Operator is not running
 * - Running: Operator is running
 */
public enum OperatorInstanceState {
	UNKNOWN, STOPPED, RUNNING;
}
