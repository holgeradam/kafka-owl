package api

import (
	"net/http"

	"github.com/kafka-owl/common/rest"
	"github.com/kafka-owl/kafka-owl/pkg/owl"
)

func (api *API) handleDescribeCluster() http.HandlerFunc {
	type response struct {
		ClusterInfo *owl.ClusterInfo `json:"clusterInfo"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		clusterInfo, err := api.OwlSvc.GetClusterInfo(r.Context())
		if err != nil {
			restErr := &rest.Error{
				Err:      err,
				Status:   http.StatusInternalServerError,
				Message:  "Could not describe cluster",
				IsSilent: false,
			}
			rest.SendRESTError(w, r, api.Logger, restErr)
			return
		}

		response := response{
			ClusterInfo: clusterInfo,
		}
		rest.SendResponse(w, r, api.Logger, http.StatusOK, response)
	}
}
