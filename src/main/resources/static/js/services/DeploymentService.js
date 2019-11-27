/* global app */

/**
 * Provides services for managing the deployment of operators.
 */
app.factory('DeploymentService', ['$http', '$resource', '$q', 'ENDPOINT_URI', 'ComponentService',
    function ($http, $resource, $q, ENDPOINT_URI, ComponentService) {
        //URLs for server requests
        const URL_DEPLOYMENT_PREFIX = ENDPOINT_URI + '/deployment/';
        const URL_GET_STATE = URL_DEPLOYMENT_PREFIX + 'state/';
        const URL_STATS_SUFFIX = '/stats';
        const URL_VALUE_LOGS_SUFFIX = '/valueLogs';
        const URL_ADAPTER_SUFFIX = '?adapter=';
        
        /**
         * [Public]
         * Performs a server request in order to retrieve the state for a certain operator and device.
         *
         * @param deviceId The id of the device for which the state should be retrieved
         * @param operatorId The id of the operator in question
         * @returns {*}
         */
        function getOperatorState(deviceId, operatorId) {
        	// /deployment/devices/{device-id}/operator-instances/{instance-id}
            return $http.get(URL_DEPLOYMENT_PREFIX + "devices/" + deviceId + "/operator-instances/" + operatorId);
        }
        
        //Expose public methods
        return {
            getOperatorState: getOperatorState
        }
    }
]);

