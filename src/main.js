import { createApp } from "vue";
import { createStore } from "vuex";
import App from "./App.vue";
import "./index.css";
import axios from "axios";

const store = createStore({
  state() {
    return {
      allGames: [],
      ratings: [],
      resp: null,
    };
  },
  mutations: {
    async setGames(state, url) {
      axios.get(url).then((response) => {
        state.resp = response.data;
      });
    },
  },
});

createApp(App).use(store).mount("#app");
